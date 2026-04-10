//! Cold Storage for Block Data
//!
//! Migrates old block data from RocksDB blocks CF to compressed archive files,
//! reducing RocksDB live data size while preserving full query capability.
//!
//! ## Architecture
//! - Archives organized by block height ranges (shards of BLOCK_SHARD_SIZE)
//! - Each shard: `/data/cold_blocks/shard_{start}_{end}.bin.gz`
//! - Format: gzip-compressed bincode of Vec<(u64, Vec<u8>)> (index, raw_json)
//! - In-memory shard index maps block_height_range -> file path for lookups
//! - Metadata key `cold_blocks_cutoff` in RocksDB tracks migration frontier
//!
//! ## Migration Strategy
//! Reuses the proven v7 incremental approach from cold_storage.rs:
//!   1. Phase 1: Sequential scan with fill_cache=false, write staging files
//!   2. Phase 2: Process MAX_SHARDS_PER_RUN staging files
//!   3. Each shard: write compressed file, then batch-delete from RocksDB
//!   4. Returns highest completed shard boundary for cutoff update

use std::collections::BTreeMap;
use std::fs;
use std::io::{BufRead, BufReader, BufWriter, Read, Write};
use std::path::{Path, PathBuf};

use flate2::read::GzDecoder;
use flate2::write::GzEncoder;
use flate2::Compression;
use log::{error, info, warn};
use serde::{Deserialize, Serialize};

use crate::blockchain::block::Block;

/// Blocks per cold storage shard file.
const BLOCK_SHARD_SIZE: u64 = 10_000;

/// Keep this many recent blocks in hot storage (RocksDB).
const KEEP_HOT_BLOCKS: u64 = 50_000;

/// Max blocks to buffer before flushing to staging.
const PHASE1_FLUSH_INTERVAL: usize = 500;

/// Max blocks to hold in memory during Phase 2 processing.
const PHASE2_BATCH_SIZE: usize = 500;

/// Max shards per migration run.
const MAX_SHARDS_PER_RUN: usize = 2;

/// A single archived block entry: index + raw JSON bytes
#[derive(Serialize, Deserialize, Debug)]
struct ArchivedBlock {
    index: u64,
    json_data: Vec<u8>,
}

/// Metadata about a block shard file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockShardInfo {
    pub start_block: u64,
    pub end_block: u64,
    pub block_count: u64,
    pub file_size_bytes: u64,
    pub file_path: String,
}

/// Statistics about the block cold storage
#[derive(Debug, Clone, Serialize)]
pub struct ColdBlocksStats {
    pub enabled: bool,
    pub cutoff_height: u64,
    pub total_shards: usize,
    pub total_archived_blocks: u64,
    pub total_archive_size_mb: f64,
    pub shard_size: u64,
    pub keep_hot_blocks: u64,
}

/// Result of a block migration run
pub struct BlockMigrationResult {
    pub migrated_count: u64,
    pub new_cutoff: u64,
    pub shards_processed: usize,
    pub has_remaining: bool,
}

/// Cold storage engine for block data
pub struct ColdBlocks {
    base_dir: PathBuf,
    shard_index: BTreeMap<u64, BlockShardInfo>,
}

impl ColdBlocks {
    /// Initialize cold blocks storage, scanning existing shard files
    pub fn open(data_dir: &str) -> Result<Self, String> {
        let base_dir = Path::new(data_dir).join("cold_blocks");

        fs::create_dir_all(&base_dir)
            .map_err(|e| format!("Failed to create cold blocks dir: {}", e))?;

        let mut cb = ColdBlocks {
            base_dir,
            shard_index: BTreeMap::new(),
        };

        cb.rebuild_index()?;

        info!(
            "Cold blocks initialized at {:?} with {} shards",
            cb.base_dir,
            cb.shard_index.len()
        );

        Ok(cb)
    }

    /// Scan directory and rebuild shard index
    fn rebuild_index(&mut self) -> Result<(), String> {
        self.shard_index.clear();

        let entries = fs::read_dir(&self.base_dir)
            .map_err(|e| format!("Failed to read cold blocks dir: {}", e))?;

        for entry in entries.flatten() {
            let path = entry.path();
            let fname = match path.file_name().and_then(|f| f.to_str()) {
                Some(f) => f.to_string(),
                None => continue,
            };

            if !fname.starts_with("shard_") || !fname.ends_with(".bin.gz") {
                continue;
            }

            let parts: Vec<&str> = fname
                .trim_start_matches("shard_")
                .trim_end_matches(".bin.gz")
                .split('_')
                .collect();

            if parts.len() != 2 {
                continue;
            }

            let start_block: u64 = match parts[0].parse() {
                Ok(v) => v,
                Err(_) => continue,
            };
            let end_block: u64 = match parts[1].parse() {
                Ok(v) => v,
                Err(_) => continue,
            };

            let file_size = entry.metadata().map(|m| m.len()).unwrap_or(0);

            self.shard_index.insert(
                start_block,
                BlockShardInfo {
                    start_block,
                    end_block,
                    block_count: 0,
                    file_size_bytes: file_size,
                    file_path: path.to_string_lossy().to_string(),
                },
            );
        }

        Ok(())
    }

    /// Migrate blocks from RocksDB to cold storage.
    ///
    /// Uses the same proven v7 approach as transaction cold storage:
    /// - fill_cache=false iterator to avoid memory bloat
    /// - Per-shard staging files with bounded memory
    /// - MAX_SHARDS_PER_RUN limit per invocation
    pub fn migrate_from_rocksdb(
        &mut self,
        db: &rocksdb::DB,
        current_height: u64,
        current_cutoff: u64,
    ) -> Result<BlockMigrationResult, String> {
        info!(
            "cold_blocks migrate: height={}, cutoff={}, shards={}",
            current_height, current_cutoff, self.shard_index.len()
        );

        let target_cutoff = if current_height > KEEP_HOT_BLOCKS {
            current_height - KEEP_HOT_BLOCKS
        } else {
            return Ok(BlockMigrationResult {
                migrated_count: 0,
                new_cutoff: current_cutoff,
                shards_processed: 0,
                has_remaining: false,
            });
        };

        let aligned_cutoff = (target_cutoff / BLOCK_SHARD_SIZE) * BLOCK_SHARD_SIZE;

        if aligned_cutoff <= current_cutoff {
            info!("Nothing to migrate: aligned={} <= cutoff={}", aligned_cutoff, current_cutoff);
            return Ok(BlockMigrationResult {
                migrated_count: 0,
                new_cutoff: current_cutoff,
                shards_processed: 0,
                has_remaining: false,
            });
        }

        let cf_blocks = match db.cf_handle("blocks") {
            Some(cf) => cf,
            None => return Err("CF_BLOCKS not found".to_string()),
        };

        // Clean up leftover staging
        let temp_dir = self.base_dir.join("_staging");
        if temp_dir.exists() {
            let _ = fs::remove_dir_all(&temp_dir);
        }
        fs::create_dir_all(&temp_dir)
            .map_err(|e| format!("Failed to create staging dir: {}", e))?;

        // Phase 1: Sequential scan -> per-shard staging files
        info!("Phase 1: scanning blocks CF ...");

        let mut read_opts = rocksdb::ReadOptions::default();
        read_opts.fill_cache(false);

        let mut scanned: u64 = 0;
        let mut eligible: u64 = 0;
        let mut skipped_hot: u64 = 0;
        let mut skipped_existing: u64 = 0;

        // Buffer: (shard_start, block_index, value_size)
        // We write block_index + raw_value to staging files
        let mut staging_writers: BTreeMap<u64, BufWriter<fs::File>> = BTreeMap::new();
        let mut flush_count: usize = 0;

        let iter = db.iterator_cf_opt(&cf_blocks, read_opts, rocksdb::IteratorMode::Start);
        for item in iter {
            let (key, value) = match item {
                Ok(kv) => kv,
                Err(e) => {
                    warn!("Blocks iterator error: {}", e);
                    continue;
                }
            };
            scanned += 1;

            if scanned % 100_000 == 0 {
                info!(
                    "  scan: {} scanned, {} eligible, {} hot, {} existing",
                    scanned, eligible, skipped_hot, skipped_existing
                );
            }

            // Block keys are u64 big-endian
            if key.len() != 8 {
                continue;
            }
            let block_index = u64::from_be_bytes(key[..8].try_into().unwrap_or([0; 8]));

            // Skip hot range
            if block_index >= aligned_cutoff {
                skipped_hot += 1;
                continue;
            }

            let shard_start = (block_index / BLOCK_SHARD_SIZE) * BLOCK_SHARD_SIZE;

            // Skip existing shards
            if self.shard_index.contains_key(&shard_start) {
                skipped_existing += 1;
                continue;
            }

            // Write to staging: each line is "block_index\tbase64(value)\n"
            let writer = staging_writers.entry(shard_start).or_insert_with(|| {
                let path = temp_dir.join(format!("staging_{}.tsv", shard_start));
                let file = fs::OpenOptions::new()
                    .create(true)
                    .append(true)
                    .open(&path)
                    .expect("Failed to open staging file");
                BufWriter::with_capacity(64 * 1024, file)
            });

            // Format: block_index\tbase64_encoded_value
            use std::io::Write as _;
            let encoded = base64_encode(&value);
            let _ = writeln!(writer, "{}\t{}", block_index, encoded);
            eligible += 1;
            flush_count += 1;

            // Periodically flush writers to prevent too many open handles
            if flush_count >= PHASE1_FLUSH_INTERVAL {
                for w in staging_writers.values_mut() {
                    let _ = w.flush();
                }
                flush_count = 0;
            }
        }

        // Final flush and close all writers
        for (_, mut w) in staging_writers.drain() {
            let _ = w.flush();
        }

        info!(
            "Phase 1 done: scanned={}, eligible={}, hot={}, existing={}",
            scanned, eligible, skipped_hot, skipped_existing
        );

        if eligible == 0 {
            let _ = fs::remove_dir_all(&temp_dir);
            return Ok(BlockMigrationResult {
                migrated_count: 0,
                new_cutoff: current_cutoff,
                shards_processed: 0,
                has_remaining: false,
            });
        }

        // Phase 2: Process staging files
        let mut staging_files: Vec<(u64, PathBuf)> = Vec::new();
        for entry in fs::read_dir(&temp_dir).map_err(|e| format!("Read staging: {}", e))? {
            let entry = entry.map_err(|e| format!("Read entry: {}", e))?;
            let fname = entry.file_name().to_string_lossy().to_string();
            if let Some(num_str) = fname
                .strip_prefix("staging_")
                .and_then(|s| s.strip_suffix(".tsv"))
            {
                if let Ok(shard_start) = num_str.parse::<u64>() {
                    staging_files.push((shard_start, entry.path()));
                }
            }
        }
        staging_files.sort_by_key(|(s, _)| *s);

        let total_staging = staging_files.len();
        let to_process = staging_files.len().min(MAX_SHARDS_PER_RUN);
        let has_remaining = total_staging > MAX_SHARDS_PER_RUN;

        info!(
            "Phase 2: {} staging files, processing {} (max={})",
            total_staging, to_process, MAX_SHARDS_PER_RUN
        );

        let mut total_migrated: u64 = 0;
        let mut shards_done: usize = 0;

        for (idx, (shard_start, staging_path)) in staging_files.iter().take(to_process).enumerate()
        {
            let shard_end = shard_start + BLOCK_SHARD_SIZE;

            info!(
                "  Block shard {}/{}: blocks {}..{} ...",
                idx + 1,
                to_process,
                shard_start,
                shard_end - 1
            );

            match self.process_block_shard(db, &cf_blocks, *shard_start, shard_end, staging_path) {
                Ok((count, size)) => {
                    info!(
                        "    OK: {} blocks, {:.2} MB",
                        count,
                        size as f64 / (1024.0 * 1024.0)
                    );
                    total_migrated += count;
                    shards_done += 1;
                }
                Err(e) => {
                    error!("    FAILED: {}. Stopping.", e);
                    break;
                }
            }

            let _ = fs::remove_file(staging_path);
        }

        let _ = fs::remove_dir_all(&temp_dir);

        let new_cutoff = self.compute_contiguous_cutoff();

        info!(
            "Block migration complete: {} blocks in {} shards, cutoff {} -> {}",
            total_migrated, shards_done, current_cutoff, new_cutoff
        );

        Ok(BlockMigrationResult {
            migrated_count: total_migrated,
            new_cutoff,
            shards_processed: shards_done,
            has_remaining,
        })
    }

    /// Compute highest contiguous shard boundary from block 0
    fn compute_contiguous_cutoff(&self) -> u64 {
        let mut expected = 0u64;
        loop {
            if self.shard_index.contains_key(&expected) {
                expected += BLOCK_SHARD_SIZE;
            } else {
                break;
            }
        }
        expected
    }

    /// Process a single block shard: write compressed archive, delete from RocksDB
    fn process_block_shard(
        &mut self,
        db: &rocksdb::DB,
        cf_blocks: &rocksdb::ColumnFamily,
        shard_start: u64,
        shard_end: u64,
        staging_path: &Path,
    ) -> Result<(u64, u64), String> {
        let shard_path = self
            .base_dir
            .join(format!("shard_{}_{}.bin.gz", shard_start, shard_end - 1));

        // Read staging file and write compressed shard
        let staging_file =
            fs::File::open(staging_path).map_err(|e| format!("Open staging: {}", e))?;
        let reader = BufReader::new(staging_file);

        let out_file = fs::File::create(&shard_path)
            .map_err(|e| format!("Create shard file: {}", e))?;
        let mut encoder = GzEncoder::new(BufWriter::new(out_file), Compression::fast());

        let mut entries: Vec<ArchivedBlock> = Vec::new();
        let mut delete_keys: Vec<[u8; 8]> = Vec::new();
        let mut count: u64 = 0;

        for line in reader.lines() {
            let line = line.map_err(|e| format!("Read staging line: {}", e))?;
            let parts: Vec<&str> = line.splitn(2, '\t').collect();
            if parts.len() != 2 {
                continue;
            }

            let block_index: u64 = match parts[0].parse() {
                Ok(v) => v,
                Err(_) => continue,
            };

            let json_data = match base64_decode(parts[1]) {
                Ok(d) => d,
                Err(_) => continue,
            };

            entries.push(ArchivedBlock {
                index: block_index,
                json_data,
            });
            delete_keys.push(block_index.to_be_bytes());
            count += 1;

            // Batch write + delete when buffer is full
            if entries.len() >= PHASE2_BATCH_SIZE {
                // Write entries to compressed file
                let batch_bytes = bincode::serialize(&entries)
                    .map_err(|e| format!("Serialize batch: {}", e))?;
                encoder
                    .write_all(&(entries.len() as u32).to_le_bytes())
                    .map_err(|e| format!("Write batch len: {}", e))?;
                encoder
                    .write_all(&batch_bytes)
                    .map_err(|e| format!("Write batch: {}", e))?;

                // Delete from RocksDB
                let mut wb = rocksdb::WriteBatch::default();
                for key in &delete_keys {
                    wb.delete_cf(cf_blocks, key);
                }
                db.write(wb)
                    .map_err(|e| format!("Batch delete blocks: {}", e))?;

                entries.clear();
                delete_keys.clear();
            }
        }

        // Flush remaining
        if !entries.is_empty() {
            let batch_bytes = bincode::serialize(&entries)
                .map_err(|e| format!("Serialize final batch: {}", e))?;
            encoder
                .write_all(&(entries.len() as u32).to_le_bytes())
                .map_err(|e| format!("Write final batch len: {}", e))?;
            encoder
                .write_all(&batch_bytes)
                .map_err(|e| format!("Write final batch: {}", e))?;

            let mut wb = rocksdb::WriteBatch::default();
            for key in &delete_keys {
                wb.delete_cf(cf_blocks, key);
            }
            db.write(wb)
                .map_err(|e| format!("Final batch delete blocks: {}", e))?;
        }

        encoder
            .finish()
            .map_err(|e| format!("Finish compression: {}", e))?;

        let file_size = fs::metadata(&shard_path).map(|m| m.len()).unwrap_or(0);

        self.shard_index.insert(
            shard_start,
            BlockShardInfo {
                start_block: shard_start,
                end_block: shard_end - 1,
                block_count: count,
                file_size_bytes: file_size,
                file_path: shard_path.to_string_lossy().to_string(),
            },
        );

        Ok((count, file_size))
    }

    /// Retrieve a block from cold storage by index
    pub fn get_block(&self, block_index: u64) -> Option<Block> {
        let shard_start = (block_index / BLOCK_SHARD_SIZE) * BLOCK_SHARD_SIZE;

        let shard_info = self.shard_index.get(&shard_start)?;
        let path = Path::new(&shard_info.file_path);
        if !path.exists() {
            warn!("Block shard file missing: {}", shard_info.file_path);
            return None;
        }

        match self.read_block_from_shard(path, block_index) {
            Ok(block) => block,
            Err(e) => {
                error!("Failed to read block {} from shard: {}", block_index, e);
                None
            }
        }
    }

    /// Read a specific block from a shard file
    fn read_block_from_shard(
        &self,
        path: &Path,
        target_index: u64,
    ) -> Result<Option<Block>, String> {
        let file = fs::File::open(path).map_err(|e| format!("Open shard: {}", e))?;
        let mut decoder = GzDecoder::new(file);

        // Read batches until we find the target block
        loop {
            // Read batch length (u32 LE)
            let mut len_buf = [0u8; 4];
            match decoder.read_exact(&mut len_buf) {
                Ok(()) => {}
                Err(ref e) if e.kind() == std::io::ErrorKind::UnexpectedEof => {
                    return Ok(None); // End of file, block not found
                }
                Err(e) => return Err(format!("Read batch len: {}", e)),
            }
            let batch_len = u32::from_le_bytes(len_buf) as usize;

            // Read the batch data
            // We need to read the bincode-serialized Vec<ArchivedBlock>
            // bincode prefixes Vec with its length as u64
            let mut batch_data = Vec::new();
            // Read until we can deserialize batch_len entries
            // Since bincode is not self-delimiting for streaming, read all remaining
            // Actually, we serialized the whole Vec, so we need to know the byte length
            // Let's change approach: read all data and deserialize
            decoder
                .read_to_end(&mut batch_data)
                .map_err(|e| format!("Read shard data: {}", e))?;

            // Prepend the len_buf we already read, then try to deserialize all batches
            let mut all_data = len_buf.to_vec();
            all_data.extend(batch_data);

            // Parse all batches from the decompressed data
            let mut cursor = 0;
            while cursor + 4 <= all_data.len() {
                let bl = u32::from_le_bytes(
                    all_data[cursor..cursor + 4].try_into().unwrap_or([0; 4]),
                ) as usize;
                cursor += 4;

                let entries: Vec<ArchivedBlock> =
                    match bincode::deserialize(&all_data[cursor..]) {
                        Ok(e) => e,
                        Err(_) => break,
                    };

                let serialized_len = bincode::serialized_size(&entries).unwrap_or(0) as usize;
                cursor += serialized_len;

                for entry in &entries {
                    if entry.index == target_index {
                        let block: Block = serde_json::from_slice(&entry.json_data)
                            .map_err(|e| format!("Deserialize block: {}", e))?;
                        return Ok(Some(block));
                    }
                }
            }

            return Ok(None);
        }
    }

    /// Check if a block index is in cold storage
    pub fn contains_block(&self, block_index: u64) -> bool {
        let shard_start = (block_index / BLOCK_SHARD_SIZE) * BLOCK_SHARD_SIZE;
        self.shard_index.contains_key(&shard_start)
    }

    /// Get cold blocks statistics
    pub fn get_stats(&self, cutoff_height: u64) -> ColdBlocksStats {
        let mut total_blocks: u64 = 0;
        let mut total_size: u64 = 0;

        for (_, shard) in &self.shard_index {
            total_blocks += shard.block_count;
            total_size += shard.file_size_bytes;
        }

        ColdBlocksStats {
            enabled: true,
            cutoff_height,
            total_shards: self.shard_index.len(),
            total_archived_blocks: total_blocks,
            total_archive_size_mb: total_size as f64 / (1024.0 * 1024.0),
            shard_size: BLOCK_SHARD_SIZE,
            keep_hot_blocks: KEEP_HOT_BLOCKS,
        }
    }

    /// Get shard list for monitoring
    pub fn get_shard_list(&self) -> Vec<&BlockShardInfo> {
        self.shard_index.values().collect()
    }
}

// Simple base64 encode/decode to avoid adding a dependency
fn base64_encode(data: &[u8]) -> String {
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut result = String::with_capacity((data.len() + 2) / 3 * 4);
    for chunk in data.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = if chunk.len() > 1 { chunk[1] as u32 } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as u32 } else { 0 };
        let triple = (b0 << 16) | (b1 << 8) | b2;
        result.push(CHARS[((triple >> 18) & 0x3F) as usize] as char);
        result.push(CHARS[((triple >> 12) & 0x3F) as usize] as char);
        if chunk.len() > 1 {
            result.push(CHARS[((triple >> 6) & 0x3F) as usize] as char);
        } else {
            result.push('=');
        }
        if chunk.len() > 2 {
            result.push(CHARS[(triple & 0x3F) as usize] as char);
        } else {
            result.push('=');
        }
    }
    result
}

fn base64_decode(input: &str) -> Result<Vec<u8>, String> {
    let input = input.trim_end_matches('=');
    let mut result = Vec::with_capacity(input.len() * 3 / 4);

    let decode_char = |c: u8| -> Result<u32, String> {
        match c {
            b'A'..=b'Z' => Ok((c - b'A') as u32),
            b'a'..=b'z' => Ok((c - b'a' + 26) as u32),
            b'0'..=b'9' => Ok((c - b'0' + 52) as u32),
            b'+' => Ok(62),
            b'/' => Ok(63),
            _ => Err(format!("Invalid base64 char: {}", c as char)),
        }
    };

    let bytes = input.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        let remaining = bytes.len() - i;
        if remaining >= 4 {
            let a = decode_char(bytes[i])?;
            let b = decode_char(bytes[i + 1])?;
            let c = decode_char(bytes[i + 2])?;
            let d = decode_char(bytes[i + 3])?;
            let triple = (a << 18) | (b << 12) | (c << 6) | d;
            result.push(((triple >> 16) & 0xFF) as u8);
            result.push(((triple >> 8) & 0xFF) as u8);
            result.push((triple & 0xFF) as u8);
            i += 4;
        } else if remaining == 3 {
            let a = decode_char(bytes[i])?;
            let b = decode_char(bytes[i + 1])?;
            let c = decode_char(bytes[i + 2])?;
            let triple = (a << 18) | (b << 12) | (c << 6);
            result.push(((triple >> 16) & 0xFF) as u8);
            result.push(((triple >> 8) & 0xFF) as u8);
            i += 3;
        } else if remaining == 2 {
            let a = decode_char(bytes[i])?;
            let b = decode_char(bytes[i + 1])?;
            let triple = (a << 18) | (b << 12);
            result.push(((triple >> 16) & 0xFF) as u8);
            i += 2;
        } else {
            break;
        }
    }

    Ok(result)
}
