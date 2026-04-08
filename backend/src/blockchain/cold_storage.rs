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

    /// Migrate transaction indexes from RocksDB to cold storage (v2).
    ///
    /// This method iterates the transactions CF directly (not blocks CF),
    /// collecting entries whose block_index < aligned_cutoff into shard buckets,
    /// writes compressed shard files, and deletes migrated entries from RocksDB.
    ///
    /// Returns the number of entries migrated.
    pub fn migrate_from_rocksdb(
        &mut self,
        db: &rocksdb::DB,
        current_height: u64,
        current_cutoff: u64,
    ) -> Result<u64, String> {
        info!(
            "migrate_from_rocksdb v2 ENTRY: height={}, cutoff={}, KEEP_HOT={}, SHARD_SIZE={}",
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

        // Phase 1: Scan transactions CF and bucket entries by shard
        info!("Phase 1: Scanning transactions CF for entries with block_index < {} ...", aligned_cutoff);
        let mut shard_buckets: HashMap<u64, Vec<(Vec<u8>, ColdEntry)>> = HashMap::new();
        let mut scanned: u64 = 0;
        let mut eligible: u64 = 0;
        let mut parse_errors: u64 = 0;
        let mut skipped_hot: u64 = 0;

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

            // Log progress every 1M entries
            if scanned % 1_000_000 == 0 {
                info!(
                    "  ... scanned {} entries, {} eligible, {} hot, {} errors",
                    scanned, eligible, skipped_hot, parse_errors
                );
            }

            // Deserialize the TxLocation
            let tx_loc: TxLocation = match serde_json::from_slice(&value) {
                Ok(loc) => loc,
                Err(_) => {
                    parse_errors += 1;
                    continue;
                }
            };

            // Check if this entry should be migrated
            if tx_loc.block_index >= aligned_cutoff {
                skipped_hot += 1;
                continue;
            }

            // Determine which shard this entry belongs to
            let shard_start = (tx_loc.block_index / SHARD_SIZE) * SHARD_SIZE;

            // Skip if this shard already exists in cold storage
            if self.shard_index.contains_key(&shard_start) {
                // This entry's shard is already archived; skip but still count as eligible
                eligible += 1;
                continue;
            }

            // Only migrate entries in the range [current_cutoff, aligned_cutoff)
            if tx_loc.block_index < current_cutoff {
                // Below current cutoff means it should already be in cold storage
                // but shard doesn't exist — collect it anyway
            }

            let tx_hash = String::from_utf8_lossy(&key).to_string();
            let entry = ColdEntry {
                tx_hash,
                block_index: tx_loc.block_index,
                tx_index: tx_loc.tx_index,
            };

            shard_buckets
                .entry(shard_start)
                .or_default()
                .push((key.to_vec(), entry));
            eligible += 1;
        }

        info!(
            "Phase 1 complete: scanned={}, eligible={}, hot={}, errors={}, shards_to_write={}",
            scanned, eligible, skipped_hot, parse_errors, shard_buckets.len()
        );

        if shard_buckets.is_empty() {
            info!("No entries to migrate");
            return Ok(0);
        }

        // Phase 2: Write shard files and delete entries from RocksDB
        info!("Phase 2: Writing {} shard files ...", shard_buckets.len());
        let mut total_migrated: u64 = 0;

        // Sort shard keys for deterministic processing
        let mut shard_keys: Vec<u64> = shard_buckets.keys().copied().collect();
        shard_keys.sort();

        for shard_start in shard_keys {
            let bucket = match shard_buckets.remove(&shard_start) {
                Some(b) => b,
                None => continue,
            };

            let shard_end = shard_start + SHARD_SIZE;
            let entry_count = bucket.len() as u64;

            // Separate keys and entries
            let tx_keys: Vec<Vec<u8>> = bucket.iter().map(|(k, _)| k.clone()).collect();
            let entries: Vec<ColdEntry> = bucket.into_iter().map(|(_, e)| e).collect();

            // Write compressed shard file
            let shard_path = self
                .base_dir
                .join(format!("shard_{}_{}.bin.gz", shard_start, shard_end - 1));

            self.write_shard(&shard_path, &entries)?;

            let file_size = fs::metadata(&shard_path)
                .map(|m| m.len())
                .unwrap_or(0);

            // Delete migrated entries from RocksDB transactions CF
            let mut batch = rocksdb::WriteBatch::default();
            for key in &tx_keys {
                batch.delete_cf(&cf_txs, key);
            }
            db.write(batch)
                .map_err(|e| format!("Failed to delete migrated tx entries: {}", e))?;

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
                "Shard {}_{}: {} entries, {:.2} MB compressed",
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
