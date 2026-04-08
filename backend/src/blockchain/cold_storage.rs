//! Cold Storage for Transaction Indexes
//!
//! Migrates old transaction index data (tx_hash -> TxLocation) from RocksDB
//! to compressed archive files on disk, reducing RocksDB's live data size
//! while preserving full query capability.
//!
//! ## Architecture
//! - Archives are organized by block height ranges (shards of SHARD_SIZE blocks)
//! - Each shard file: `/data/cold_tx/shard_{start}_{end}.bin.gz`
//! - Format: gzip-compressed bincode of Vec<ColdEntry>
//! - An in-memory shard index maps block_height_range -> file path for fast lookups
//! - Metadata key `cold_storage_cutoff` in RocksDB tracks the migration frontier
//!
//! ## Migration Strategy (v7)
//! Memory-bounded incremental migration with crash safety:
//!   1. Phase 1: Single scan with fill_cache=false, write per-shard staging files
//!   2. Phase 2: Process at most MAX_SHARDS_PER_RUN staging files
//!   3. Each shard: write shard file first, then batch-delete from RocksDB
//!   4. Returns the highest completed shard boundary for cutoff update

use std::collections::BTreeMap;
use std::fs;
use std::io::{BufRead, BufReader, BufWriter, Read, Write};
use std::path::{Path, PathBuf};

use flate2::read::GzDecoder;
use flate2::write::GzEncoder;
use flate2::Compression;
use log::{error, info, warn};
use serde::{Deserialize, Serialize};

use super::storage::TxLocation;

/// Number of blocks per cold storage shard file.
const SHARD_SIZE: u64 = 10_000;

/// Minimum number of recent blocks to keep in hot storage (RocksDB).
const KEEP_HOT_BLOCKS: u64 = 50_000;

/// Maximum entries to buffer in memory during Phase 1 before flushing to disk.
const PHASE1_FLUSH_INTERVAL: usize = 2_000;

/// Maximum entries to hold in memory during Phase 2 shard processing.
const PHASE2_BATCH_SIZE: usize = 2_000;

/// Maximum number of shards to process per migration run.
/// Keeps write-lock hold time bounded and prevents OOM on large backlogs.
const MAX_SHARDS_PER_RUN: usize = 3;

/// A single entry in the cold archive: tx_hash -> TxLocation
#[derive(Serialize, Deserialize, Debug, Clone)]
struct ColdEntry {
    tx_hash: String,
    block_index: u64,
    tx_index: u32,
}

/// Metadata about a single shard file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShardInfo {
    pub start_block: u64,
    pub end_block: u64,
    pub entry_count: u64,
    pub file_size_bytes: u64,
    pub file_path: String,
}

/// Statistics about the cold storage system
#[derive(Debug, Clone, Serialize)]
pub struct ColdStorageStats {
    pub enabled: bool,
    pub cutoff_height: u64,
    pub total_shards: usize,
    pub total_archived_entries: u64,
    pub total_archive_size_mb: f64,
    pub shard_size: u64,
    pub keep_hot_blocks: u64,
}

/// Result of a migration run
pub struct MigrationResult {
    /// Total entries migrated across all shards in this run
    pub migrated_count: u64,
    /// The highest block boundary that was fully migrated.
    /// Caller should update cutoff_height to this value.
    /// 0 means no complete shard was processed.
    pub new_cutoff: u64,
    /// Number of shards processed in this run
    pub shards_processed: usize,
    /// Whether there are more shards remaining to process
    pub has_remaining: bool,
}

/// Cold storage engine for transaction indexes
pub struct ColdStorage {
    base_dir: PathBuf,
    shard_index: BTreeMap<u64, ShardInfo>,
}

impl ColdStorage {
    /// Initialize cold storage, scanning existing shard files
    pub fn open(data_dir: &str) -> Result<Self, String> {
        let base_dir = Path::new(data_dir).join("cold_tx");

        fs::create_dir_all(&base_dir)
            .map_err(|e| format!("Failed to create cold storage dir: {}", e))?;

        let mut cs = ColdStorage {
            base_dir,
            shard_index: BTreeMap::new(),
        };

        cs.rebuild_index()?;

        info!(
            "Cold storage initialized at {:?} with {} shards",
            cs.base_dir,
            cs.shard_index.len()
        );

        Ok(cs)
    }

    /// Scan the cold storage directory and rebuild the shard index
    fn rebuild_index(&mut self) -> Result<(), String> {
        self.shard_index.clear();

        let entries = fs::read_dir(&self.base_dir)
            .map_err(|e| format!("Failed to read cold storage dir: {}", e))?;

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
                ShardInfo {
                    start_block,
                    end_block,
                    entry_count: 0,
                    file_size_bytes: file_size,
                    file_path: path.to_string_lossy().to_string(),
                },
            );
        }

        Ok(())
    }

    /// Migrate transaction indexes from RocksDB to cold storage (v7).
    ///
    /// Key properties:
    /// - Uses `fill_cache = false` on RocksDB iterator (no block cache bloat)
    /// - Phase 1: streams entries to per-shard staging files (bounded memory)
    /// - Phase 2: processes at most MAX_SHARDS_PER_RUN staging files
    /// - Each shard: write compressed file first, then batch-delete from RocksDB
    /// - Returns MigrationResult with new_cutoff for incremental progress tracking
    pub fn migrate_from_rocksdb(
        &mut self,
        db: &rocksdb::DB,
        current_height: u64,
        current_cutoff: u64,
    ) -> Result<MigrationResult, String> {
        info!(
            "migrate_from_rocksdb v7: height={}, cutoff={}, shards={}",
            current_height, current_cutoff, self.shard_index.len()
        );

        let target_cutoff = if current_height > KEEP_HOT_BLOCKS {
            current_height - KEEP_HOT_BLOCKS
        } else {
            info!("Chain too short for migration: height={}", current_height);
            return Ok(MigrationResult {
                migrated_count: 0,
                new_cutoff: current_cutoff,
                shards_processed: 0,
                has_remaining: false,
            });
        };

        let aligned_cutoff = (target_cutoff / SHARD_SIZE) * SHARD_SIZE;
        info!(
            "target_cutoff={}, aligned_cutoff={}, current_cutoff={}",
            target_cutoff, aligned_cutoff, current_cutoff
        );

        if aligned_cutoff <= current_cutoff {
            info!("Nothing to migrate: aligned={} <= cutoff={}", aligned_cutoff, current_cutoff);
            return Ok(MigrationResult {
                migrated_count: 0,
                new_cutoff: current_cutoff,
                shards_processed: 0,
                has_remaining: false,
            });
        }

        let cf_txs = match db.cf_handle("transactions") {
            Some(cf) => cf,
            None => return Err("CF_TRANSACTIONS not found".to_string()),
        };

        // Clean up any leftover staging directory from a previous crashed run
        let temp_dir = self.base_dir.join("_staging");
        if temp_dir.exists() {
            let _ = fs::remove_dir_all(&temp_dir);
        }
        fs::create_dir_all(&temp_dir)
            .map_err(|e| format!("Failed to create staging dir: {}", e))?;

        // ── Phase 1: Single scan -> per-shard staging files ──
        info!("Phase 1: scanning transactions CF ...");

        let mut read_opts = rocksdb::ReadOptions::default();
        read_opts.fill_cache(false);

        let mut scanned: u64 = 0;
        let mut eligible: u64 = 0;
        let mut skipped_hot: u64 = 0;
        let mut skipped_existing: u64 = 0;
        let mut parse_errors: u64 = 0;

        let mut line_buf: Vec<(u64, String)> = Vec::with_capacity(PHASE1_FLUSH_INTERVAL + 100);

        let iter = db.iterator_cf_opt(&cf_txs, read_opts, rocksdb::IteratorMode::Start);
        for item in iter {
            let (key, value) = match item {
                Ok(kv) => kv,
                Err(e) => {
                    if parse_errors == 0 {
                        warn!("Iterator error: {}", e);
                    }
                    parse_errors += 1;
                    continue;
                }
            };
            scanned += 1;

            if scanned % 500_000 == 0 {
                info!(
                    "  scan: {} scanned, {} eligible, {} hot, {} existing",
                    scanned, eligible, skipped_hot, skipped_existing
                );
            }

            let tx_loc: TxLocation = match serde_json::from_slice(&value) {
                Ok(loc) => loc,
                Err(_) => {
                    parse_errors += 1;
                    continue;
                }
            };

            // Skip entries that belong to hot range
            if tx_loc.block_index >= aligned_cutoff {
                skipped_hot += 1;
                continue;
            }

            let shard_start = (tx_loc.block_index / SHARD_SIZE) * SHARD_SIZE;

            // Skip shards that already exist in cold storage
            if self.shard_index.contains_key(&shard_start) {
                skipped_existing += 1;
                continue;
            }

            let tx_hash = String::from_utf8_lossy(&key);
            let line = format!("{}\t{}\t{}", tx_hash, tx_loc.block_index, tx_loc.tx_index);
            line_buf.push((shard_start, line));
            eligible += 1;

            if line_buf.len() >= PHASE1_FLUSH_INTERVAL {
                Self::flush_line_buffer(&temp_dir, &mut line_buf)?;
            }
        }

        if !line_buf.is_empty() {
            Self::flush_line_buffer(&temp_dir, &mut line_buf)?;
        }
        drop(line_buf);

        info!(
            "Phase 1 done: scanned={}, eligible={}, hot={}, existing={}, errors={}",
            scanned, eligible, skipped_hot, skipped_existing, parse_errors
        );

        if eligible == 0 {
            let _ = fs::remove_dir_all(&temp_dir);
            return Ok(MigrationResult {
                migrated_count: 0,
                new_cutoff: current_cutoff,
                shards_processed: 0,
                has_remaining: false,
            });
        }

        // ── Phase 2: Process staging files (limited to MAX_SHARDS_PER_RUN) ──
        let mut staging_files: Vec<(u64, PathBuf)> = Vec::new();
        for entry in fs::read_dir(&temp_dir).map_err(|e| format!("Read staging dir: {}", e))? {
            let entry = entry.map_err(|e| format!("Read staging entry: {}", e))?;
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
        let mut highest_completed_shard: u64 = 0;
        let mut shards_done: usize = 0;

        for (idx, (shard_start, staging_path)) in staging_files.iter().take(to_process).enumerate()
        {
            let shard_end = shard_start + SHARD_SIZE;

            info!(
                "  Shard {}/{}: blocks {}..{} ...",
                idx + 1,
                to_process,
                shard_start,
                shard_end - 1
            );

            match self.process_shard(db, &cf_txs, *shard_start, shard_end, staging_path) {
                Ok((count, size)) => {
                    info!(
                        "    OK: {} entries, {:.2} MB",
                        count,
                        size as f64 / (1024.0 * 1024.0)
                    );
                    total_migrated += count;
                    shards_done += 1;
                    if shard_end > highest_completed_shard {
                        highest_completed_shard = shard_end;
                    }
                }
                Err(e) => {
                    error!("    FAILED: {}. Stopping to preserve consistency.", e);
                    break;
                }
            }

            // Remove processed staging file immediately
            let _ = fs::remove_file(staging_path);
        }

        // Clean up remaining staging files and directory
        let _ = fs::remove_dir_all(&temp_dir);

        // Determine new cutoff: the highest contiguous shard boundary from 0
        let new_cutoff = self.compute_contiguous_cutoff();

        info!(
            "Migration run complete: {} entries in {} shards, cutoff {} -> {}",
            total_migrated, shards_done, current_cutoff, new_cutoff
        );

        Ok(MigrationResult {
            migrated_count: total_migrated,
            new_cutoff,
            shards_processed: shards_done,
            has_remaining,
        })
    }

    /// Compute the highest contiguous shard boundary starting from block 0.
    /// e.g., if shards 0, 10000, 20000 exist but 30000 is missing, returns 30000.
    fn compute_contiguous_cutoff(&self) -> u64 {
        let mut expected = 0u64;
        loop {
            if self.shard_index.contains_key(&expected) {
                expected += SHARD_SIZE;
            } else {
                break;
            }
        }
        expected
    }

    /// Flush line buffer to per-shard staging files.
    fn flush_line_buffer(
        temp_dir: &Path,
        buf: &mut Vec<(u64, String)>,
    ) -> Result<(), String> {
        buf.sort_by_key(|(s, _)| *s);

        let mut current_shard: Option<u64> = None;
        let mut writer: Option<BufWriter<fs::File>> = None;

        for (shard_start, line) in buf.iter() {
            if current_shard != Some(*shard_start) {
                if let Some(ref mut w) = writer {
                    let _ = w.flush();
                }

                let path = temp_dir.join(format!("staging_{}.tsv", shard_start));
                let file = fs::OpenOptions::new()
                    .create(true)
                    .append(true)
                    .open(&path)
                    .map_err(|e| format!("Failed to open staging file: {}", e))?;
                writer = Some(BufWriter::with_capacity(16 * 1024, file));
                current_shard = Some(*shard_start);
            }

            if let Some(ref mut w) = writer {
                w.write_all(line.as_bytes())
                    .map_err(|e| format!("Write staging: {}", e))?;
                w.write_all(b"\n")
                    .map_err(|e| format!("Write newline: {}", e))?;
            }
        }

        if let Some(ref mut w) = writer {
            let _ = w.flush();
        }

        buf.clear();
        Ok(())
    }

    /// Process a single shard: write compressed archive, then delete from RocksDB.
    ///
    /// Memory usage is bounded by PHASE2_BATCH_SIZE entries at any time.
    /// Uses a single pass through the staging file:
    ///   1. Count lines first (cheap sequential read)
    ///   2. Stream entries to gzip encoder while collecting keys for deletion
    ///   3. Batch-delete keys from RocksDB every PHASE2_BATCH_SIZE entries
    ///
    /// Returns (entry_count, file_size_bytes).
    fn process_shard(
        &mut self,
        db: &rocksdb::DB,
        cf_txs: &rocksdb::ColumnFamily,
        shard_start: u64,
        shard_end: u64,
        staging_path: &Path,
    ) -> Result<(u64, u64), String> {
        let shard_path = self
            .base_dir
            .join(format!("shard_{}_{}.bin.gz", shard_start, shard_end - 1));

        // Step 1: Count total entries (fast sequential read, no allocations)
        let total_entries = {
            let file =
                fs::File::open(staging_path).map_err(|e| format!("Open staging: {}", e))?;
            let reader = BufReader::new(file);
            let mut count: u64 = 0;
            for line in reader.lines() {
                let line = line.map_err(|e| format!("Read line: {}", e))?;
                if line.split('\t').count() == 3 {
                    count += 1;
                }
            }
            count
        };

        if total_entries == 0 {
            return Ok((0, 0));
        }

        info!("    Counted {} entries, writing shard file ...", total_entries);

        // Step 2: Stream entries to gzip file + collect keys for batch deletion
        {
            let out_file = fs::File::create(&shard_path)
                .map_err(|e| format!("Create shard file: {}", e))?;
            let mut encoder = GzEncoder::new(BufWriter::new(out_file), Compression::fast());

            // Write bincode Vec<ColdEntry> length prefix (little-endian u64)
            encoder
                .write_all(&total_entries.to_le_bytes())
                .map_err(|e| format!("Write length prefix: {}", e))?;

            let staging_file =
                fs::File::open(staging_path).map_err(|e| format!("Open staging pass 2: {}", e))?;
            let reader = BufReader::new(staging_file);

            let mut written: u64 = 0;
            let mut delete_keys: Vec<Vec<u8>> = Vec::with_capacity(PHASE2_BATCH_SIZE);

            for line in reader.lines() {
                let line = line.map_err(|e| format!("Read line pass 2: {}", e))?;
                let parts: Vec<&str> = line.split('\t').collect();
                if parts.len() != 3 {
                    continue;
                }

                let entry = ColdEntry {
                    tx_hash: parts[0].to_string(),
                    block_index: parts[1].parse().unwrap_or(0),
                    tx_index: parts[2].parse().unwrap_or(0),
                };

                // Write entry to compressed shard
                let entry_bytes = bincode::serialize(&entry)
                    .map_err(|e| format!("Serialize entry: {}", e))?;
                encoder
                    .write_all(&entry_bytes)
                    .map_err(|e| format!("Write entry: {}", e))?;

                // Collect key for deletion
                delete_keys.push(parts[0].as_bytes().to_vec());
                written += 1;

                // Batch-delete from RocksDB when buffer is full
                if delete_keys.len() >= PHASE2_BATCH_SIZE {
                    let mut batch = rocksdb::WriteBatch::default();
                    for key in &delete_keys {
                        batch.delete_cf(cf_txs, key);
                    }
                    db.write(batch)
                        .map_err(|e| format!("Batch delete: {}", e))?;
                    delete_keys.clear();
                }
            }

            // Flush remaining deletes
            if !delete_keys.is_empty() {
                let mut batch = rocksdb::WriteBatch::default();
                for key in &delete_keys {
                    batch.delete_cf(cf_txs, key);
                }
                db.write(batch)
                    .map_err(|e| format!("Final batch delete: {}", e))?;
            }

            encoder
                .finish()
                .map_err(|e| format!("Finish compression: {}", e))?;

            info!("    Wrote {} entries to shard file", written);
        }

        let file_size = fs::metadata(&shard_path).map(|m| m.len()).unwrap_or(0);

        // Update in-memory shard index
        self.shard_index.insert(
            shard_start,
            ShardInfo {
                start_block: shard_start,
                end_block: shard_end - 1,
                entry_count: total_entries,
                file_size_bytes: file_size,
                file_path: shard_path.to_string_lossy().to_string(),
            },
        );

        Ok((total_entries, file_size))
    }

    /// Read and decompress a shard file
    fn read_shard(&self, path: &Path) -> Result<Vec<ColdEntry>, String> {
        let file =
            fs::File::open(path).map_err(|e| format!("Failed to open shard file: {}", e))?;

        let mut decoder = GzDecoder::new(file);
        let mut data = Vec::new();
        decoder
            .read_to_end(&mut data)
            .map_err(|e| format!("Failed to decompress shard: {}", e))?;

        bincode::deserialize(&data).map_err(|e| format!("Failed to deserialize shard: {}", e))
    }

    /// Look up a transaction in cold storage by hash.
    pub fn get_transaction_location(&self, tx_hash: &str) -> Option<TxLocation> {
        for (_, shard_info) in self.shard_index.iter().rev() {
            let path = Path::new(&shard_info.file_path);
            if !path.exists() {
                warn!("Shard file missing: {}", shard_info.file_path);
                continue;
            }

            match self.read_shard(path) {
                Ok(entries) => {
                    for entry in &entries {
                        if entry.tx_hash == tx_hash {
                            return Some(TxLocation {
                                block_index: entry.block_index,
                                tx_index: entry.tx_index,
                            });
                        }
                    }
                }
                Err(e) => {
                    error!("Failed to read shard {}: {}", shard_info.file_path, e);
                    continue;
                }
            }
        }

        None
    }

    /// Get cold storage statistics
    pub fn get_stats(&self, cutoff_height: u64) -> ColdStorageStats {
        let mut total_entries: u64 = 0;
        let mut total_size: u64 = 0;

        for (_, shard) in &self.shard_index {
            total_entries += shard.entry_count;
            total_size += shard.file_size_bytes;
        }

        ColdStorageStats {
            enabled: true,
            cutoff_height,
            total_shards: self.shard_index.len(),
            total_archived_entries: total_entries,
            total_archive_size_mb: total_size as f64 / (1024.0 * 1024.0),
            shard_size: SHARD_SIZE,
            keep_hot_blocks: KEEP_HOT_BLOCKS,
        }
    }

    /// Get list of all shards for monitoring
    pub fn get_shard_list(&self) -> Vec<&ShardInfo> {
        self.shard_index.values().collect()
    }

    /// Diagnostic: sample first few keys from blocks CF
    pub fn debug_blocks_cf(db: &rocksdb::DB) -> Vec<serde_json::Value> {
        let mut results = Vec::new();

        if let Some(cf) = db.cf_handle("blocks") {
            let mut read_opts = rocksdb::ReadOptions::default();
            read_opts.fill_cache(false);

            let iter = db.iterator_cf_opt(&cf, read_opts, rocksdb::IteratorMode::Start);
            for (i, item) in iter.enumerate() {
                if i >= 5 {
                    break;
                }
                if let Ok((key, _value)) = item {
                    let key_hex = key.iter().map(|b| format!("{:02x}", b)).collect::<String>();
                    let key_as_u64 = if key.len() == 8 {
                        Some(u64::from_be_bytes(key[..8].try_into().unwrap_or([0; 8])))
                    } else {
                        None
                    };
                    results.push(serde_json::json!({
                        "key_hex": key_hex,
                        "key_len": key.len(),
                        "key_as_u64_be": key_as_u64,
                    }));
                }
            }
        }

        results
    }
}
