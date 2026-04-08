//! Cold Storage Layer for Transaction Indexes
//!
//! Migrates old transaction index data (tx_hash → TxLocation) from RocksDB
//! to compressed archive files on disk, reducing RocksDB's live data size
//! while preserving full query capability.
//!
//! ## Architecture
//! - Archives are organized by block height ranges (shards of SHARD_SIZE blocks)
//! - Each shard file: `/data/cold_tx/shard_{start}_{end}.bin.gz`
//! - Format: gzip-compressed bincode of Vec<(String, TxLocation)>
//! - An in-memory shard index maps block_height_range → file path for fast lookups
//! - Metadata key `cold_storage_cutoff` in RocksDB tracks the migration frontier

use std::collections::BTreeMap;
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
/// 10,000 blocks × ~40 tx/block × ~80 bytes/entry ≈ 32 MB uncompressed → ~4-8 MB compressed
const SHARD_SIZE: u64 = 10_000;

/// Minimum number of recent blocks to keep in hot storage (RocksDB).
/// Transactions in the most recent KEEP_HOT_BLOCKS blocks are never migrated.
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
    /// Base directory for cold storage files
    base_dir: PathBuf,
    /// In-memory index: shard_start_block → ShardInfo
    shard_index: BTreeMap<u64, ShardInfo>,
}

impl ColdStorage {
    /// Initialize cold storage, scanning existing shard files
    pub fn open(data_dir: &str) -> Result<Self, String> {
        let base_dir = Path::new(data_dir).join("cold_tx");

        // Create directory if it doesn't exist
        fs::create_dir_all(&base_dir)
            .map_err(|e| format!("Failed to create cold storage dir: {}", e))?;

        let mut cs = ColdStorage {
            base_dir,
            shard_index: BTreeMap::new(),
        };

        // Scan existing shard files to rebuild the in-memory index
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

            // Parse shard filename: shard_{start}_{end}.bin.gz
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

            // Read entry count from the file header (first 8 bytes after decompression)
            // For efficiency, we store entry_count = 0 here and update on first access
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

    /// Migrate transaction indexes from RocksDB to cold storage.
    ///
    /// This method:
    /// 1. Determines which block ranges are eligible for migration
    /// 2. Reads tx indexes from RocksDB for those ranges
    /// 3. Writes compressed shard files
    /// 4. Deletes the migrated entries from RocksDB
    ///
    /// Returns the number of entries migrated.
    pub fn migrate_from_rocksdb(
        &mut self,
        db: &rocksdb::DB,
        current_height: u64,
        current_cutoff: u64,
    ) -> Result<u64, String> {
        // Calculate the new cutoff: keep the most recent KEEP_HOT_BLOCKS in RocksDB
        let target_cutoff = if current_height > KEEP_HOT_BLOCKS {
            current_height - KEEP_HOT_BLOCKS
        } else {
            return Ok(0); // Chain too short, nothing to migrate
        };

        // Align cutoff to shard boundaries
        let aligned_cutoff = (target_cutoff / SHARD_SIZE) * SHARD_SIZE;

        if aligned_cutoff <= current_cutoff {
            return Ok(0); // Nothing new to migrate
        }

        info!(
            "Cold storage migration: current_cutoff={}, target_cutoff={}, aligned={}, height={}",
            current_cutoff, target_cutoff, aligned_cutoff, current_height
        );

        let cf_txs = match db.cf_handle("transactions") {
            Some(cf) => cf,
            None => {
                error!("Cold storage: CF_TRANSACTIONS not found in DB");
                return Err("CF_TRANSACTIONS not found".to_string());
            }
        };
        let cf_blocks = match db.cf_handle("blocks") {
            Some(cf) => cf,
            None => {
                error!("Cold storage: CF_BLOCKS not found in DB");
                return Err("CF_BLOCKS not found".to_string());
            }
        };

        let mut total_migrated: u64 = 0;

        // Process each shard range that needs migration
        let mut shard_start = (current_cutoff / SHARD_SIZE) * SHARD_SIZE;
        while shard_start < aligned_cutoff {
            let shard_end = shard_start + SHARD_SIZE;

            // Skip if this shard already exists
            if self.shard_index.contains_key(&shard_start) {
                shard_start = shard_end;
                continue;
            }

            info!(
                "Migrating shard: blocks {} to {} ...",
                shard_start,
                shard_end - 1
            );

            // Collect all tx entries for blocks in this range
            let mut entries: Vec<ColdEntry> = Vec::new();
            let mut tx_keys_to_delete: Vec<Vec<u8>> = Vec::new();
            let mut blocks_found: u64 = 0;
            let mut blocks_missing: u64 = 0;
            let mut deserialize_errors: u64 = 0;

            for block_idx in shard_start..shard_end {
                // Read the block from RocksDB to get its transactions
                let block_key = block_idx.to_be_bytes();
                let block_data = match db.get_cf(&cf_blocks, &block_key) {
                    Ok(Some(data)) => data,
                    Ok(None) => {
                        blocks_missing += 1;
                        continue;
                    }
                    Err(e) => {
                        if blocks_found == 0 && block_idx == shard_start {
                            warn!("Cold storage: RocksDB read error at block {}: {}", block_idx, e);
                        }
                        blocks_missing += 1;
                        continue;
                    }
                };

                let block: crate::blockchain::block::Block = match serde_json::from_slice(&block_data) {
                    Ok(b) => b,
                    Err(e) => {
                        if deserialize_errors == 0 {
                            warn!("Cold storage: Failed to deserialize block {}: {}", block_idx, e);
                        }
                        deserialize_errors += 1;
                        continue;
                    }
                };
                blocks_found += 1;

                for (tx_idx, tx) in block.transactions.iter().enumerate() {
                    entries.push(ColdEntry {
                        tx_hash: tx.hash.clone(),
                        block_index: block_idx,
                        tx_index: tx_idx as u32,
                    });
                    tx_keys_to_delete.push(tx.hash.as_bytes().to_vec());
                }
            }

            info!(
                "Shard {}_{}: found {} blocks, {} missing, {} deser errors, {} tx entries",
                shard_start, shard_end - 1, blocks_found, blocks_missing, deserialize_errors, entries.len()
            );

            if entries.is_empty() {
                info!("Shard {}_{}: no entries, skipping", shard_start, shard_end - 1);
                shard_start = shard_end;
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

            // Delete migrated entries from RocksDB transactions CF
            let mut batch = rocksdb::WriteBatch::default();
            for key in &tx_keys_to_delete {
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
            shard_start = shard_end;
        }

        if total_migrated > 0 {
            info!(
                "Cold storage migration complete: {} entries migrated, new cutoff={}",
                total_migrated, aligned_cutoff
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
        // We need to search through shards. Since we don't have a global hash index,
        // we search from newest to oldest shard (most likely to find recent cold tx first).
        for (_, shard_info) in self.shard_index.iter().rev() {
            let path = Path::new(&shard_info.file_path);
            if !path.exists() {
                warn!("Shard file missing: {}", shard_info.file_path);
                continue;
            }

            match self.read_shard(path) {
                Ok(entries) => {
                    // Binary search would be ideal but entries are sorted by block, not hash.
                    // Linear scan within the shard (typically 400K entries, fast enough).
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
