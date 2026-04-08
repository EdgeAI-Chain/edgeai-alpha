//! Cold Storage Layer for Transaction Indexes
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
//! ## Migration Strategy (v2)
//! Instead of reading blocks CF (which may have been compacted away), we iterate
//! the transactions CF directly. Each entry is `tx_hash -> TxLocation { block_index, tx_index }`.
//! We deserialize TxLocation to determine which shard each tx belongs to, collect
//! entries by shard, write shard files, then delete migrated entries from RocksDB.

use std::collections::{BTreeMap, HashMap};
use std::fs;
use std::io::{Read, Write};
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

    /// Migrate transaction indexes from RocksDB to cold storage (v3).
    ///
    /// **Memory-efficient streaming approach**: Instead of collecting all entries
    /// into a giant HashMap (which caused OOM on 1GB VMs with 1.7GB of tx data),
    /// this version processes one shard at a time:
    ///   1. First pass: count entries per shard (lightweight — only stores counts)
    ///   2. For each shard: re-scan, collect only that shard's entries, write, delete
    ///
    /// Peak memory = O(entries_in_one_shard) instead of O(all_eligible_entries).
    ///
    /// Returns the number of entries migrated.
    pub fn migrate_from_rocksdb(
        &mut self,
        db: &rocksdb::DB,
        current_height: u64,
        current_cutoff: u64,
    ) -> Result<u64, String> {
        info!(
            "migrate_from_rocksdb v3 ENTRY: height={}, cutoff={}, KEEP_HOT={}, SHARD_SIZE={}",
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

        // ── Pass 1: Lightweight scan to discover which shards need migration ──
        info!("Pass 1: Counting entries per shard (block_index < {}) ...", aligned_cutoff);
        let mut shard_counts: BTreeMap<u64, u64> = BTreeMap::new();
        let mut scanned: u64 = 0;
        let mut parse_errors: u64 = 0;
        let mut skipped_hot: u64 = 0;

        let iter = db.iterator_cf(&cf_txs, rocksdb::IteratorMode::Start);
        for item in iter {
            let (_key, value) = match item {
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
                info!("  pass1: scanned {} entries ...", scanned);
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
                continue;
            }

            *shard_counts.entry(shard_start).or_insert(0) += 1;
        }

        info!(
            "Pass 1 complete: scanned={}, hot={}, errors={}, shards_to_migrate={}",
            scanned, skipped_hot, parse_errors, shard_counts.len()
        );

        if shard_counts.is_empty() {
            info!("No entries to migrate");
            return Ok(0);
        }

        // Log shard summary
        let total_eligible: u64 = shard_counts.values().sum();
        info!(
            "Will migrate {} entries across {} shards",
            total_eligible, shard_counts.len()
        );

        // ── Pass 2+: Process one shard at a time ──
        let mut total_migrated: u64 = 0;
        let shard_starts: Vec<u64> = shard_counts.keys().copied().collect();

        for (shard_idx, &shard_start) in shard_starts.iter().enumerate() {
            let shard_end = shard_start + SHARD_SIZE;
            let expected_count = shard_counts[&shard_start];

            info!(
                "Shard {}/{}: processing blocks {}..{} (~{} entries)",
                shard_idx + 1,
                shard_starts.len(),
                shard_start,
                shard_end - 1,
                expected_count
            );

            // Collect entries for this single shard
            let mut entries: Vec<ColdEntry> = Vec::with_capacity(expected_count as usize);
            let mut keys_to_delete: Vec<Vec<u8>> = Vec::with_capacity(expected_count as usize);

            let iter = db.iterator_cf(&cf_txs, rocksdb::IteratorMode::Start);
            for item in iter {
                let (key, value) = match item {
                    Ok(kv) => kv,
                    Err(_) => continue,
                };

                let tx_loc: TxLocation = match serde_json::from_slice(&value) {
                    Ok(loc) => loc,
                    Err(_) => continue,
                };

                // Only collect entries belonging to this shard
                if tx_loc.block_index >= shard_start && tx_loc.block_index < shard_end {
                    let tx_hash = String::from_utf8_lossy(&key).to_string();
                    entries.push(ColdEntry {
                        tx_hash,
                        block_index: tx_loc.block_index,
                        tx_index: tx_loc.tx_index,
                    });
                    keys_to_delete.push(key.to_vec());
                }
            }

            if entries.is_empty() {
                info!("  Shard {}_{}: no entries found (already deleted?)", shard_start, shard_end - 1);
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

            // Drop entries to free memory before batch delete
            drop(entries);

            // Delete migrated entries from RocksDB in batches of 10,000
            for chunk in keys_to_delete.chunks(10_000) {
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
                shard_start,
                ShardInfo {
                    start_block: shard_start,
                    end_block: shard_end - 1,
                    entry_count,
                    file_size_bytes: file_size,
                    file_path: shard_path.to_string_lossy().to_string(),
                },
            );

            info!(
                "  Shard {}_{}: {} entries, {:.2} MB compressed",
                shard_start,
                shard_end - 1,
                entry_count,
                file_size as f64 / (1024.0 * 1024.0)
            );

            total_migrated += entry_count;
        }

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
