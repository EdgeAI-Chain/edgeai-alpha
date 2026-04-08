//! Cold Storage for Transaction Indexes
//!
//! Migrates old transaction index data (tx_hash → TxLocation) from RocksDB
//! to compressed archive files on disk, reducing RocksDB's live data size
//! while preserving full query capability.
//!
//! ## Architecture
//! - Archives are organized by block height ranges (shards of SHARD_SIZE blocks)
//! - Each shard file: `/data/cold_tx/shard_{start}_{end}.bin.gz`
//! - Format: gzip-compressed bincode of Vec<ColdEntry>
//! - An in-memory shard index maps block_height_range → file path for fast lookups
//! - Metadata key `cold_storage_cutoff` in RocksDB tracks the migration frontier
//!
//! ## Migration Strategy (v4)
//! Single-scan + disk temp files to minimize both memory and I/O:
//!   1. Single scan of transactions CF, writing eligible entries to per-shard temp files
//!   2. For each temp file: read entries, write compressed shard, delete from RocksDB
//! This avoids both OOM (no large in-memory collections) and slow multi-pass scans.

use std::collections::BTreeMap;
use std::fs;
use std::io::{BufRead, BufReader, BufWriter, Read, Write};
use std::path::{Path, PathBuf};

use flate2::read::GzDecoder;
use flate2::write::GzEncoder;
use flate2::Compression;
use log::{info, warn, error};
use serde::{Deserialize, Serialize};

use super::storage::TxLocation;

/// Number of blocks per cold storage shard file.
const SHARD_SIZE: u64 = 10_000;

/// Minimum number of recent blocks to keep in hot storage (RocksDB).
const KEEP_HOT_BLOCKS: u64 = 50_000;

/// A single entry in the cold archive: tx_hash → TxLocation
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
                    entry_count: 0, // Lazy-loaded
                    file_size_bytes: file_size,
                    file_path: path.to_string_lossy().to_string(),
                },
            );
        }

        Ok(())
    }

    /// Migrate transaction indexes from RocksDB to cold storage (v4).
    ///
    /// **Single-scan + disk temp files** for minimal memory and I/O:
    ///   1. Single scan: iterate transactions CF once, writing eligible entries
    ///      to per-shard temporary line-delimited files on disk
    ///   2. Per-shard finalize: read temp file, build ColdEntry vec, write
    ///      compressed shard, batch-delete from RocksDB, update index
    ///
    /// Peak memory ≈ O(entries_in_one_shard) ≈ 10-50 MB.
    /// Total I/O = 1 full scan + N small temp file reads (vs N full scans in v3).
    ///
    /// Returns the number of entries migrated.
    pub fn migrate_from_rocksdb(
        &mut self,
        db: &rocksdb::DB,
        current_height: u64,
        current_cutoff: u64,
    ) -> Result<u64, String> {
        info!(
            "migrate_from_rocksdb v4 ENTRY: height={}, cutoff={}, KEEP_HOT={}, SHARD_SIZE={}",
            current_height, current_cutoff, KEEP_HOT_BLOCKS, SHARD_SIZE
        );

        // Calculate the new cutoff
        let target_cutoff = if current_height > KEEP_HOT_BLOCKS {
            current_height - KEEP_HOT_BLOCKS
        } else {
            info!(
                "Chain too short for migration: height={} <= KEEP_HOT={}",
                current_height, KEEP_HOT_BLOCKS
            );
            return Ok(0);
        };

        // Align cutoff to shard boundaries
        let aligned_cutoff = (target_cutoff / SHARD_SIZE) * SHARD_SIZE;
        info!(
            "Migration calc: target_cutoff={}, aligned_cutoff={}, current_cutoff={}",
            target_cutoff, aligned_cutoff, current_cutoff
        );

        if aligned_cutoff <= current_cutoff {
            info!(
                "Nothing to migrate: aligned_cutoff={} <= current_cutoff={}",
                aligned_cutoff, current_cutoff
            );
            return Ok(0);
        }

        let cf_txs = match db.cf_handle("transactions") {
            Some(cf) => cf,
            None => {
                error!("Cold storage: CF_TRANSACTIONS not found in DB");
                return Err("CF_TRANSACTIONS not found".to_string());
            }
        };

        // Create temp directory for shard staging files
        let temp_dir = self.base_dir.join("_staging");
        if temp_dir.exists() {
            let _ = fs::remove_dir_all(&temp_dir);
        }
        fs::create_dir_all(&temp_dir)
            .map_err(|e| format!("Failed to create staging dir: {}", e))?;

        // ── Phase 1: Single scan → per-shard temp files ──
        // Each line in a temp file: "tx_hash_hex\tblock_index\ttx_index\n"
        // We keep open file handles in a BTreeMap, flushing periodically.
        info!(
            "Phase 1: Single scan of transactions CF, writing to staging files ..."
        );

        let mut shard_writers: BTreeMap<u64, BufWriter<fs::File>> = BTreeMap::new();
        let mut scanned: u64 = 0;
        let mut eligible: u64 = 0;
        let mut parse_errors: u64 = 0;
        let mut skipped_hot: u64 = 0;
        let mut skipped_existing: u64 = 0;

        let iter = db.iterator_cf(&cf_txs, rocksdb::IteratorMode::Start);
        for item in iter {
            let (key, value) = match item {
                Ok(kv) => kv,
                Err(e) => {
                    if parse_errors == 0 {
                        warn!("Cold storage: iterator error: {}", e);
                    }
                    parse_errors += 1;
                    continue;
                }
            };
            scanned += 1;

            if scanned % 1_000_000 == 0 {
                info!(
                    "  phase1: scanned={}, eligible={}, hot={}, existing={}, errors={}",
                    scanned, eligible, skipped_hot, skipped_existing, parse_errors
                );
            }

            let tx_loc: TxLocation = match serde_json::from_slice(&value) {
                Ok(loc) => loc,
                Err(_) => {
                    parse_errors += 1;
                    continue;
                }
            };

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

            // Get or create the writer for this shard
            let writer = shard_writers.entry(shard_start).or_insert_with(|| {
                let path = temp_dir.join(format!("staging_{}.tsv", shard_start));
                let file = fs::File::create(&path).expect("Failed to create staging file");
                BufWriter::with_capacity(64 * 1024, file) // 64KB buffer
            });

            // Write: tx_hash_as_utf8 \t block_index \t tx_index \n
            let tx_hash = String::from_utf8_lossy(&key);
            let line = format!("{}\t{}\t{}\n", tx_hash, tx_loc.block_index, tx_loc.tx_index);
            writer.write_all(line.as_bytes())
                .map_err(|e| format!("Failed to write staging: {}", e))?;

            eligible += 1;
        }

        // Flush and close all writers
        for (_, mut writer) in shard_writers {
            writer.flush().map_err(|e| format!("Failed to flush staging: {}", e))?;
        }

        info!(
            "Phase 1 complete: scanned={}, eligible={}, hot={}, existing={}, errors={}",
            scanned, eligible, skipped_hot, skipped_existing, parse_errors
        );

        if eligible == 0 {
            info!("No entries to migrate");
            let _ = fs::remove_dir_all(&temp_dir);
            return Ok(0);
        }

        // ── Phase 2: Process each staging file → shard file + delete ──
        // Collect staging files sorted by shard_start
        let mut staging_files: Vec<(u64, PathBuf)> = Vec::new();
        for entry in fs::read_dir(&temp_dir).map_err(|e| format!("Read staging dir: {}", e))? {
            let entry = entry.map_err(|e| format!("Read staging entry: {}", e))?;
            let fname = entry.file_name().to_string_lossy().to_string();
            if let Some(num_str) = fname.strip_prefix("staging_").and_then(|s| s.strip_suffix(".tsv")) {
                if let Ok(shard_start) = num_str.parse::<u64>() {
                    staging_files.push((shard_start, entry.path()));
                }
            }
        }
        staging_files.sort_by_key(|(s, _)| *s);

        info!("Phase 2: Processing {} staging files ...", staging_files.len());
        let mut total_migrated: u64 = 0;

        for (idx, (shard_start, staging_path)) in staging_files.iter().enumerate() {
            let shard_end = shard_start + SHARD_SIZE;

            info!(
                "  Shard {}/{}: blocks {}..{} ...",
                idx + 1, staging_files.len(), shard_start, shard_end - 1
            );

            // Read staging file line by line
            let file = fs::File::open(&staging_path)
                .map_err(|e| format!("Open staging file: {}", e))?;
            let reader = BufReader::new(file);

            let mut entries: Vec<ColdEntry> = Vec::new();
            let mut keys_to_delete: Vec<Vec<u8>> = Vec::new();

            for line in reader.lines() {
                let line = line.map_err(|e| format!("Read staging line: {}", e))?;
                let parts: Vec<&str> = line.split('\t').collect();
                if parts.len() != 3 {
                    continue;
                }

                let tx_hash = parts[0].to_string();
                let block_index: u64 = match parts[1].parse() {
                    Ok(v) => v,
                    Err(_) => continue,
                };
                let tx_index: u32 = match parts[2].parse() {
                    Ok(v) => v,
                    Err(_) => continue,
                };

                entries.push(ColdEntry {
                    tx_hash: tx_hash.clone(),
                    block_index,
                    tx_index,
                });
                keys_to_delete.push(tx_hash.into_bytes());
            }

            if entries.is_empty() {
                info!("    No entries in staging file, skipping");
                continue;
            }

            let entry_count = entries.len() as u64;

            // Write compressed shard file
            let shard_path = self
                .base_dir
                .join(format!("shard_{}_{}.bin.gz", shard_start, shard_end - 1));

            self.write_shard(&shard_path, &entries)?;

            let file_size = fs::metadata(&shard_path)
                .map(|m| m.len())
                .unwrap_or(0);

            // Free entries memory before batch delete
            drop(entries);

            // Delete migrated entries from RocksDB in batches of 5,000
            for chunk in keys_to_delete.chunks(5_000) {
                let mut batch = rocksdb::WriteBatch::default();
                for key in chunk {
                    batch.delete_cf(&cf_txs, key);
                }
                db.write(batch)
                    .map_err(|e| format!("Failed to delete migrated tx entries: {}", e))?;
            }

            // Free keys memory
            drop(keys_to_delete);

            // Update shard index
            self.shard_index.insert(
                *shard_start,
                ShardInfo {
                    start_block: *shard_start,
                    end_block: shard_end - 1,
                    entry_count,
                    file_size_bytes: file_size,
                    file_path: shard_path.to_string_lossy().to_string(),
                },
            );

            info!(
                "    Shard {}_{}: {} entries, {:.2} MB compressed",
                shard_start,
                shard_end - 1,
                entry_count,
                file_size as f64 / (1024.0 * 1024.0)
            );

            total_migrated += entry_count;

            // Delete the staging file to free disk space
            let _ = fs::remove_file(&staging_path);
        }

        // Clean up staging directory
        let _ = fs::remove_dir_all(&temp_dir);

        if total_migrated > 0 {
            info!(
                "Cold storage migration complete: {} entries migrated across {} shards, new cutoff={}",
                total_migrated, self.shard_index.len(), aligned_cutoff
            );
        }

        Ok(total_migrated)
    }

    /// Write a shard file with gzip compression
    fn write_shard(&self, path: &Path, entries: &[ColdEntry]) -> Result<(), String> {
        let data = bincode::serialize(entries)
            .map_err(|e| format!("Failed to serialize shard: {}", e))?;

        let file = fs::File::create(path)
            .map_err(|e| format!("Failed to create shard file: {}", e))?;

        let mut encoder = GzEncoder::new(file, Compression::default());
        encoder
            .write_all(&data)
            .map_err(|e| format!("Failed to write compressed shard: {}", e))?;
        encoder
            .finish()
            .map_err(|e| format!("Failed to finish compression: {}", e))?;

        Ok(())
    }

    /// Read and decompress a shard file
    fn read_shard(&self, path: &Path) -> Result<Vec<ColdEntry>, String> {
        let file = fs::File::open(path)
            .map_err(|e| format!("Failed to open shard file: {}", e))?;

        let mut decoder = GzDecoder::new(file);
        let mut data = Vec::new();
        decoder
            .read_to_end(&mut data)
            .map_err(|e| format!("Failed to decompress shard: {}", e))?;

        bincode::deserialize(&data)
            .map_err(|e| format!("Failed to deserialize shard: {}", e))
    }

    /// Look up a transaction in cold storage by hash.
    /// Returns TxLocation if found, None otherwise.
    pub fn get_transaction_location(&self, tx_hash: &str) -> Option<TxLocation> {
        // Search through shards from newest to oldest
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
}
