use std::collections::HashMap;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use log::{info, error};
use std::fs;
use std::path::Path;

use crate::blockchain::block::Block;
use crate::blockchain::transaction::{Transaction, TransactionType};

const DATA_DIR: &str = "/data";
const CHAIN_FILE: &str = "chain.json";

/// Account state in the blockchain
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Account {
    pub address: String,
    pub balance: u64,
    pub nonce: u64,
    pub data_contributions: u64,
    pub reputation_score: f64,
    pub staked_amount: u64,
}

impl Account {
    pub fn new(address: String) -> Self {
        Account {
            address,
            balance: 0,
            nonce: 0,
            data_contributions: 0,
            reputation_score: 0.0,
            staked_amount: 0,
        }
    }
}

/// Blockchain state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChainState {
    pub accounts: HashMap<String, Account>,
    pub data_registry: HashMap<String, DataEntry>,  // data_hash -> DataEntry
    pub total_supply: u64,
    pub total_staked: u64,
}

/// Data entry in the registry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataEntry {
    pub hash: String,
    pub owner: String,
    pub price: u64,
    pub quality_score: f64,
    pub timestamp: i64,
    pub purchases: u64,
    pub category: String,
}

/// The main blockchain structure
#[derive(Serialize, Deserialize)]
pub struct Blockchain {
    pub chain: Vec<Block>,
    #[serde(skip)]
    pub pending_transactions: Vec<Transaction>,
    pub state: ChainState,
    pub difficulty: u64,
    pub block_reward: u64,
    pub data_reward_base: u64,
    pub last_block_time: i64,
}

impl Blockchain {
    /// Create a new blockchain with genesis block or load from disk
    pub fn new() -> Self {
        // Try to load from disk first
        if let Some(chain) = Self::load_from_disk() {
            info!("Blockchain loaded from disk with {} blocks", chain.chain.len());
            return chain;
        }

        info!("No existing blockchain found, creating new genesis chain");
        let genesis = Block::genesis();
        
        let mut accounts = HashMap::new();
        // Initialize genesis account
        accounts.insert("genesis".to_string(), Account {
            address: "genesis".to_string(),
            balance: 1_000_000_000,
            nonce: 0,
            data_contributions: 0,
            reputation_score: 100.0,
            staked_amount: 0,
        });
        
        // Initialize simulated IoT device accounts with 100 EDGE each
        // This enables realistic Transfer and DataPurchase transactions
        let simulated_devices = [
            "edge_node_001", "edge_node_002", "edge_node_003",
            "edge_node_004", "edge_node_005", "edge_node_006",
            "edge_node_007", "edge_node_008", "edge_node_009",
            "edge_node_010", "factory_hub_a", "factory_hub_b",
            "city_gateway", "agri_node_1", "med_device_1",
            "power_grid_01", "transit_hub", "warehouse_sys",
        ];
        
        for device in simulated_devices.iter() {
            accounts.insert(device.to_string(), Account {
                address: device.to_string(),
                balance: 100,  // 100 EDGE initial balance
                nonce: 0,
                data_contributions: 0,
                reputation_score: 50.0,
                staked_amount: 0,
            });
        }
        info!("Initialized {} simulated device accounts with 100 EDGE each", simulated_devices.len());
        
        let state = ChainState {
            accounts,
            data_registry: HashMap::new(),
            total_supply: 1_000_000_000,
            total_staked: 0,
        };
        
        info!("Blockchain initialized with genesis block");
        
        let chain = Blockchain {
            chain: vec![genesis],
            pending_transactions: Vec::new(),
            state,
            difficulty: 2,
            block_reward: 100,
            data_reward_base: 50,
            last_block_time: Utc::now().timestamp(),
        };

        // Save initial state
        chain.save_to_disk();
        chain
    }

    /// Load blockchain from disk
    fn load_from_disk() -> Option<Self> {
        let chain_path = Path::new(DATA_DIR).join(CHAIN_FILE);
        
        if !chain_path.exists() {
            return None;
        }

        match fs::read_to_string(&chain_path) {
            Ok(data) => {
                match serde_json::from_str::<Blockchain>(&data) {
                    Ok(mut chain) => {
                        // Re-initialize pending transactions as empty since they are skipped in serialization
                        chain.pending_transactions = Vec::new();
                        
                        // Ensure simulated device accounts exist with minimum balance
                        let simulated_devices = [
                            "edge_node_001", "edge_node_002", "edge_node_003",
                            "edge_node_004", "edge_node_005", "edge_node_006",
                            "edge_node_007", "edge_node_008", "edge_node_009",
                            "edge_node_010", "factory_hub_a", "factory_hub_b",
                            "city_gateway", "agri_node_1", "med_device_1",
                            "power_grid_01", "transit_hub", "warehouse_sys",
                        ];
                        
                        let mut initialized_count = 0;
                        for device in simulated_devices.iter() {
                            if !chain.state.accounts.contains_key(*device) {
                                chain.state.accounts.insert(device.to_string(), Account {
                                    address: device.to_string(),
                                    balance: 100,  // 100 EDGE initial balance
                                    nonce: 0,
                                    data_contributions: 0,
                                    reputation_score: 50.0,
                                    staked_amount: 0,
                                });
                                initialized_count += 1;
                            }
                        }
                        if initialized_count > 0 {
                            info!("Initialized {} missing device accounts with 100 EDGE", initialized_count);
                        }
                        
                        Some(chain)
                    },
                    Err(e) => {
                        error!("Failed to parse blockchain data: {}", e);
                        None
                    }
                }
            },
            Err(e) => {
                error!("Failed to read blockchain file: {}", e);
                None
            }
        }
    }

    /// Save blockchain to disk
    pub fn save_to_disk(&self) {
        // Ensure data directory exists
        if let Err(e) = fs::create_dir_all(DATA_DIR) {
            error!("Failed to create data directory: {}", e);
            return;
        }

        let chain_path = Path::new(DATA_DIR).join(CHAIN_FILE);
        
        match serde_json::to_string_pretty(self) {
            Ok(data) => {
                if let Err(e) = fs::write(&chain_path, data) {
                    error!("Failed to write blockchain to disk: {}", e);
                } else {
                    // info!("Blockchain saved to disk");
                }
            },
            Err(e) => {
                error!("Failed to serialize blockchain: {}", e);
            }
        }
    }
    
    /// Get the latest block
    pub fn latest_block(&self) -> &Block {
        self.chain.last().unwrap()
    }
    
    /// Get block by index
    pub fn get_block(&self, index: u64) -> Option<&Block> {
        self.chain.get(index as usize)
    }
    
    /// Get block by hash
    pub fn get_block_by_hash(&self, hash: &str) -> Option<&Block> {
        self.chain.iter().find(|b| b.hash == hash)
    }

    /// Get transaction by hash (returns a clone to avoid lifetime issues)
    pub fn get_transaction(&self, hash: &str) -> Option<Transaction> {
        // Search in pending transactions first
        if let Some(tx) = self.pending_transactions.iter().find(|tx| tx.hash == hash) {
            return Some(tx.clone());
        }
        
        // Search in blocks
        for block in self.chain.iter().rev() {
            if let Some(tx) = block.transactions.iter().find(|tx| tx.hash == hash) {
                return Some(tx.clone());
            }
        }
        
        None
    }
    
    /// Add a transaction to pending pool
    pub fn add_transaction(&mut self, tx: Transaction) -> Result<String, String> {
        // Validate transaction hash
        if !tx.verify() {
            return Err("Invalid transaction hash".to_string());
        }
        
        // Apply validation rules based on transaction type
        match tx.tx_type {
            // Transfer requires balance check
            TransactionType::Transfer => {
                let sender_balance = self.get_balance(&tx.sender);
                if sender_balance < tx.total_output() {
                    return Err("Insufficient balance".to_string());
                }
            },
            // DataContribution: IoT devices contribute data and receive rewards
            // No balance check needed - devices earn tokens by contributing data (PoIE)
            TransactionType::DataContribution => {
                // Future: Add data quality validation, device signature verification, etc.
            },
            // DataPurchase requires balance check
            TransactionType::DataPurchase => {
                let sender_balance = self.get_balance(&tx.sender);
                if sender_balance < tx.total_output() {
                    return Err("Insufficient balance".to_string());
                }
            },
            // Contract operations may require balance for gas fees
            TransactionType::ContractDeploy | TransactionType::ContractCall => {
                // For now, allow contract operations without balance check
                // Future: Implement gas fee mechanism
            },
            // Genesis and Reward transactions are system-generated
            _ => {}
        }
        
        let tx_hash = tx.hash.clone();
        let tx_type = tx.tx_type.clone();
        self.pending_transactions.push(tx);
        info!("Transaction {} added to pending pool (type: {:?})", &tx_hash[..8], tx_type);
        
        Ok(tx_hash)
    }
    
    /// Mine a new block with pending transactions
    pub fn mine_block(&mut self, validator: String) -> Result<Block, String> {
        // Allow empty blocks to keep chain alive
        // if self.pending_transactions.is_empty() {
        //     return Err("No pending transactions".to_string());
        // }
        
        let previous_hash = self.latest_block().hash.clone();
        let index = self.chain.len() as u64;
        
        // Select transactions for the block (max 100)
        let transactions: Vec<Transaction> = self.pending_transactions
            .drain(..self.pending_transactions.len().min(100))
            .collect();
        
        // Create block reward transaction
        let reward_tx = Transaction::reward(
            validator.clone(),
            self.block_reward,
            format!("Block {} mining reward", index),
        );
        
        let mut block_txs = vec![reward_tx];
        block_txs.extend(transactions);
        
        // Calculate PoIE adjusted difficulty
        // Higher entropy (more IoT data) -> Lower difficulty
        // We keep difficulty LOW and FIXED to ensure consistent block times
        // PoIE now serves as a "bonus" to make mining even faster/cheaper for good data
        let data_entropy = Block::calculate_data_entropy(&block_txs);
        let entropy_bonus = (data_entropy * 0.5) as u64; 
        
        // Base difficulty is fixed at 2 to ensure fast mining
        // The block time is controlled by the interval in main.rs, not by mining difficulty
        let base_difficulty = 2;
        
        let adjusted_difficulty = if base_difficulty > entropy_bonus {
            base_difficulty - entropy_bonus
        } else {
            1 // Minimum difficulty
        };

        info!("Mining block {} with PoIE difficulty: {} (Base: {}, Entropy Bonus: {})", 
            index, adjusted_difficulty, base_difficulty, entropy_bonus);

        // Create and mine the block
        let mut block = Block::new(
            index,
            previous_hash,
            block_txs,
            adjusted_difficulty,
            validator.clone(),
        );
        
        block.mine(adjusted_difficulty);
        
        // No dynamic difficulty adjustment - we want fixed block times controlled by the scheduler
        self.last_block_time = Utc::now().timestamp();
        
        // Apply block to state
        self.apply_block(&block)?;
        
        // Add block to chain
        self.chain.push(block.clone());
        
        info!("Block {} mined by {}", index, &validator[..8.min(validator.len())]);
        
        // Save to disk after every block
        self.save_to_disk();
        
        Ok(block)
    }
    
    /// Apply block transactions to state
    fn apply_block(&mut self, block: &Block) -> Result<(), String> {
        for tx in &block.transactions {
            self.apply_transaction(tx)?;
        }
        Ok(())
    }
    
    /// Apply a single transaction to state
    fn apply_transaction(&mut self, tx: &Transaction) -> Result<(), String> {
        match tx.tx_type {
            TransactionType::Transfer => {
                self.transfer(&tx.sender, &tx.outputs[0].recipient, tx.outputs[0].amount)?;
            }
            TransactionType::DataContribution => {
                self.process_data_contribution(tx)?;
            }
            TransactionType::DataPurchase => {
                self.process_data_purchase(tx)?;
            }
            TransactionType::Reward => {
                self.add_balance(&tx.outputs[0].recipient, tx.outputs[0].amount);
            }
            TransactionType::Stake => {
                self.process_stake(tx)?;
            }
            TransactionType::Unstake => {
                self.process_unstake(tx)?;
            }
            TransactionType::Genesis => {
                // Already handled in initialization
            }
            _ => {}
        }
        Ok(())
    }
    
    /// Transfer tokens between accounts
    fn transfer(&mut self, from: &str, to: &str, amount: u64) -> Result<(), String> {
        let sender = self.state.accounts.get_mut(from)
            .ok_or("Sender account not found")?;
        
        if sender.balance < amount {
            return Err("Insufficient balance".to_string());
        }
        
        sender.balance -= amount;
        sender.nonce += 1;
        
        self.add_balance(to, amount);
        
        Ok(())
    }
    
    /// Add balance to an account (creates account if not exists)
    fn add_balance(&mut self, address: &str, amount: u64) {
        let account = self.state.accounts
            .entry(address.to_string())
            .or_insert_with(|| Account::new(address.to_string()));
        account.balance += amount;
    }
    
    /// Process data contribution (PoIE reward)
    fn process_data_contribution(&mut self, tx: &Transaction) -> Result<(), String> {
        let quality = tx.data_quality.as_ref()
            .ok_or("Data quality not calculated")?;
        
        let data_hash = tx.outputs[0].data_hash.as_ref()
            .ok_or("Data hash not found")?;
        
        // Calculate reward based on data quality (PoIE)
        let reward = (self.data_reward_base as f64 * quality.overall_score) as u64;
        
        // Add reward to contributor
        self.add_balance(&tx.sender, reward);
        
        // Update contributor stats
        if let Some(account) = self.state.accounts.get_mut(&tx.sender) {
            account.data_contributions += 1;
            account.reputation_score += quality.overall_score * 10.0;
        }
        
        // Register data in marketplace
        let entry = DataEntry {
            hash: data_hash.clone(),
            owner: tx.sender.clone(),
            price: (quality.overall_score * 100.0) as u64,
            quality_score: quality.overall_score,
            timestamp: tx.timestamp.timestamp(),
            purchases: 0,
            category: "IoT".to_string(),
        };
        
        self.state.data_registry.insert(data_hash.clone(), entry);
        
        Ok(())
    }
    
    /// Process data purchase
    fn process_data_purchase(&mut self, tx: &Transaction) -> Result<(), String> {
        let data_hash = tx.outputs[0].data_hash.as_ref()
            .ok_or("Data hash not found")?;
        
        // Extract needed data to avoid double borrow
        let (owner, price) = {
            let entry = self.state.data_registry.get(data_hash)
                .ok_or("Data not found in registry")?;
            (entry.owner.clone(), entry.price)
        };
        
        // Transfer payment
        self.transfer(&tx.sender, &owner, price)?;
        
        // Update stats - re-borrow mutably
        if let Some(entry) = self.state.data_registry.get_mut(data_hash) {
            entry.purchases += 1;
        }
        
        Ok(())
    }
    
    /// Process stake
    fn process_stake(&mut self, tx: &Transaction) -> Result<(), String> {
        let amount = tx.outputs[0].amount;
        
        let account = self.state.accounts.get_mut(&tx.sender)
            .ok_or("Account not found")?;
        
        if account.balance < amount {
            return Err("Insufficient balance for staking".to_string());
        }
        
        account.balance -= amount;
        account.staked_amount += amount;
        self.state.total_staked += amount;
        
        Ok(())
    }
    
    /// Process unstake
    fn process_unstake(&mut self, tx: &Transaction) -> Result<(), String> {
        let amount = tx.outputs[0].amount;
        
        let account = self.state.accounts.get_mut(&tx.sender)
            .ok_or("Account not found")?;
        
        if account.staked_amount < amount {
            return Err("Insufficient staked amount".to_string());
        }
        
        account.staked_amount -= amount;
        account.balance += amount;
        self.state.total_staked -= amount;
        
        Ok(())
    }
    
    /// Get account state
    pub fn get_account(&self, address: &str) -> Option<&Account> {
        self.state.accounts.get(address)
    }
    
    /// Get account balance (read-only)
    pub fn get_balance(&self, address: &str) -> u64 {
        self.state.accounts.get(address).map(|a| a.balance).unwrap_or(0)
    }
    
    /// Get transactions for an address
    pub fn get_transactions_for_address(&self, address: &str) -> Vec<&Transaction> {
        let mut txs = Vec::new();
        
        for block in &self.chain {
            for tx in &block.transactions {
                if tx.sender == address {
                    txs.push(tx);
                    continue;
                }
                
                for output in &tx.outputs {
                    if output.recipient == address {
                        txs.push(tx);
                        break;
                    }
                }
            }
        }
        
        txs
    }
    
    /// Get blockchain stats with PoIE network metrics
    pub fn get_stats(&self) -> ChainStats {
        let height = self.chain.len() as u64;
        let total_transactions: u64 = self.chain.iter().map(|b| b.transactions.len() as u64).sum();
        
        // Calculate network entropy (sum of all block entropies)
        let network_entropy: f64 = self.chain.iter()
            .map(|b| b.header.data_entropy)
            .sum();
        
        // Calculate average transactions per block
        let avg_tx_per_block = if height > 0 {
            total_transactions as f64 / height as f64
        } else {
            0.0
        };
        
        // Calculate data throughput (estimated bytes per second)
        // Each transaction averages ~256 bytes, block time is 10s
        let data_throughput = if height > 0 {
            (total_transactions as f64 * 256.0) / (height as f64 * 10.0)
        } else {
            0.0
        };
        
        // Calculate TPS (transactions per second)
        let tps = if height > 0 {
            total_transactions as f64 / (height as f64 * 10.0)
        } else {
            0.0
        };
        
        // Calculate validator power index
        // Based on active accounts, data entries, and network entropy
        let validator_power = {
            let active = self.state.accounts.len() as f64;
            let data = self.state.data_registry.len() as f64;
            let entropy_factor = network_entropy / (height.max(1) as f64);
            (active * 0.3 + data * 0.3 + entropy_factor * 100.0 * 0.4).max(0.0)
        };
        
        ChainStats {
            height,
            total_transactions,
            total_supply: self.state.total_supply,
            total_staked: self.state.total_staked,
            active_accounts: self.state.accounts.len() as u64,
            data_entries: self.state.data_registry.len() as u64,
            difficulty: self.difficulty,
            last_block_time: self.last_block_time,
            network_entropy,
            avg_tx_per_block,
            data_throughput,
            tps,
            validator_power,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChainStats {
    pub height: u64,
    pub total_transactions: u64,
    pub total_supply: u64,
    pub total_staked: u64,
    pub active_accounts: u64,
    pub data_entries: u64,
    pub difficulty: u64,
    pub last_block_time: i64,
    // PoIE Network Metrics
    pub network_entropy: f64,
    pub avg_tx_per_block: f64,
    pub data_throughput: f64,
    pub tps: f64,
    pub validator_power: f64,
}
