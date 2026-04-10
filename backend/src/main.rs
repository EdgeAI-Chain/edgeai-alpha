mod blockchain;
mod consensus;
mod contracts;
mod crypto;
mod data_market;
mod network;
mod api;
mod iot;
mod validators;

use std::sync::Arc;
use tokio::sync::RwLock;
use actix_web::{web, App, HttpServer, middleware};
use actix_cors::Cors;
use actix_web::http::header;
use actix_files::Files;
use log::{info, error, LevelFilter};
use env_logger::Builder;
use std::fs;
use std::path::Path;

use blockchain::{Blockchain, MempoolManager};
use consensus::{PoIEConsensus, DeviceRegistry, StakingManager, StakingConfig, GovernanceManager, GovernanceConfig};

/// Check disk usage for a given path using statvfs.
/// Returns (used_percent, used_gb, total_gb) or None on failure.
fn check_disk_usage(path: &str) -> Option<(f64, f64, f64)> {
    use std::ffi::CString;
    use std::mem::MaybeUninit;
    
    let c_path = CString::new(path).ok()?;
    let mut stat: MaybeUninit<libc::statvfs> = MaybeUninit::uninit();
    
    let result = unsafe { libc::statvfs(c_path.as_ptr(), stat.as_mut_ptr()) };
    if result != 0 {
        return None;
    }
    
    let stat = unsafe { stat.assume_init() };
    let block_size = stat.f_frsize as f64;
    let total_blocks = stat.f_blocks as f64;
    let free_blocks = stat.f_bfree as f64;
    
    let total_bytes = total_blocks * block_size;
    let free_bytes = free_blocks * block_size;
    let used_bytes = total_bytes - free_bytes;
    
    if total_bytes == 0.0 {
        return None;
    }
    
    let used_pct = (used_bytes / total_bytes) * 100.0;
    let used_gb = used_bytes / (1024.0 * 1024.0 * 1024.0);
    let total_gb = total_bytes / (1024.0 * 1024.0 * 1024.0);
    
    Some((used_pct, used_gb, total_gb))
}
use data_market::DataMarketplace;
use network::{NetworkManager, NodeType};
use network::libp2p_network::{NetworkConfig, NetworkCommand, NetworkEvent, start_p2p_network};
use api::{
    AppState, DeviceState, StakingState, ContractState, GovernanceState, DexState,
    configure_routes, configure_wallet_routes, configure_data_routes, 
    configure_device_routes, configure_staking_routes, configure_contract_routes,
    configure_governance_routes, configure_dex_routes
};
use contracts::WasmRuntime;

const DATA_DIR: &str = "/data";

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Initialize logger
    Builder::new()
        .filter_level(LevelFilter::Info)
        .format_timestamp_secs()
        .init();
    
    info!("============================================");
    info!("   EdgeAI Blockchain Node v0.6.1");
    info!("   The Most Intelligent Data Chain");
    info!("   PoIE 2.0 + Staking + Contracts + DAO!");
    info!("============================================");
    
    // Ensure data directory exists
    if !Path::new(DATA_DIR).exists() {
        info!("Creating data directory at {}", DATA_DIR);
        fs::create_dir_all(DATA_DIR)?;
    } else {
        info!("Data directory found at {}", DATA_DIR);
    }

    // Initialize blockchain (will load from disk if available)
    let blockchain = Arc::new(RwLock::new(Blockchain::new()));
    
    // Initialize consensus
    let consensus = Arc::new(RwLock::new(PoIEConsensus::new()));
    info!("PoIE consensus engine initialized");
    
    // Initialize device registry (PoIE 2.0)
    let device_registry = Arc::new(RwLock::new(DeviceRegistry::new()));
    info!("Device Registry initialized (PoIE 2.0)");
    
    // Initialize staking manager with custom config
    let staking_config = StakingConfig {
        min_validator_stake: 10_000,
        min_delegation: 100,
        unbonding_period: 7 * 24 * 60 * 60, // 7 days
        max_validators: 100,
        slash_double_sign: 0.05,  // 5%
        slash_downtime: 0.01,     // 1%
        min_uptime: 0.95,         // 95%
        downtime_window: 1000,
        commission_range: (0.0, 0.25), // 0-25%
    };
    // Create staking manager and register initial validators before wrapping in Arc
    let mut staking_mgr = StakingManager::new(staking_config);
    
    // Register initial validators for testnet
    {
        use consensus::ValidatorDescription;
        
        let initial_validators = vec![
            ("edge_validator_foundation", "EdgeAI Foundation", "Official foundation validator node", 15_000_000, 0.05),
            ("edge_validator_iot_hub", "IoT Network Hub", "High-performance edge computing node", 12_000_000, 0.08),
            ("edge_validator_datastream", "DataStream Validator", "Specialized in medical IoT data", 9_500_000, 0.10),
            ("edge_validator_smartcity", "Smart City Node", "Urban infrastructure data processing", 8_200_000, 0.07),
            ("edge_validator_green", "Green Energy Validator", "Renewable energy monitoring network", 7_100_000, 0.06),
        ];
        
        for (addr, name, desc, stake, commission) in initial_validators {
            let description = ValidatorDescription {
                moniker: name.to_string(),
                identity: None,
                website: Some(format!("https://{}.edgeai.network", addr)),
                security_contact: None,
                details: Some(desc.to_string()),
            };
            let _ = staking_mgr.register_validator(
                addr.to_string(),
                format!("{}_operator", addr),
                stake,
                commission,
                description,
            );
        }
        info!("Registered {} initial validators for testnet", 5);
    }
    
    let staking_manager = Arc::new(RwLock::new(staking_mgr));
    info!("Staking Manager initialized (Delegation + Slashing)");
    
    // Initialize governance manager with custom config
    let governance_config = GovernanceConfig {
        min_deposit: 10_000_000_000_000_000_000_000, // 10,000 EDGE
        voting_period: 7 * 24 * 60 * 60,             // 7 days
        quorum_percentage: 33,                       // 33% participation
        pass_threshold: 50,                          // 50% yes votes
        veto_threshold: 33,                          // 33% veto to reject
        execution_delay: 2 * 24 * 60 * 60,           // 2 days
        max_active_proposals: 10,
    };
    let governance_manager = Arc::new(RwLock::new(GovernanceManager::new(governance_config)));
    info!("Governance Manager initialized (On-chain DAO)");
    
    // Initialize marketplace
    let marketplace = Arc::new(RwLock::new(DataMarketplace::new()));
    info!("Data marketplace initialized");
    
    // Initialize WASM runtime for smart contracts
    let wasm_runtime = Arc::new(RwLock::new(WasmRuntime::new()));
    info!("WASM Smart Contract Runtime initialized");
    
    // Initialize network
    let node_id = format!("node_{}", uuid::Uuid::new_v4().to_string()[..8].to_string());
    let network = Arc::new(NetworkManager::new(
        node_id.clone(),
        NodeType::FullNode,
        8333,
    ));
    info!("Network manager initialized (Node ID: {})", &node_id);
    
    // Initialize libp2p P2P network
    // Read configuration from environment variables
    let p2p_port: u16 = std::env::var("EDGEAI_P2P_PORT")
        .unwrap_or_else(|_| "9000".to_string())
        .parse()
        .unwrap_or(9000);
    
    let bootstrap_nodes: Vec<String> = std::env::var("EDGEAI_BOOTSTRAP_NODES")
        .unwrap_or_default()
        .split(',')
        .filter(|s| !s.is_empty())
        .map(|s| s.trim().to_string())
        .collect();
    
    if !bootstrap_nodes.is_empty() {
        info!("Bootstrap nodes: {:?}", bootstrap_nodes);
    }
    
    let p2p_config = NetworkConfig {
        listen_port: p2p_port,
        bootstrap_nodes,
        enable_mdns: true,
        max_peers: 50,
    };
    
    #[allow(unused_mut)]
    let (p2p_command_tx, mut p2p_event_rx) = match start_p2p_network(p2p_config).await {
        Ok((tx, rx)) => {
            info!("libp2p P2P network started on port {}", p2p_port);
            (Some(tx), Some(rx))
        }
        Err(e) => {
            log::warn!("Failed to start P2P network: {}. Running in standalone mode.", e);
            (None, None)
        }
    };
    
    // Store P2P command sender for broadcasting
    let p2p_tx = Arc::new(tokio::sync::RwLock::new(p2p_command_tx));
    
    // Create app state
    let app_state = web::Data::new(AppState {
        blockchain: blockchain.clone(),
        consensus: consensus.clone(),
        marketplace: marketplace.clone(),
        network: network.clone(),
        migration_status: Arc::new(std::sync::Mutex::new("IDLE".to_string())),
        block_migration_status: Arc::new(std::sync::Mutex::new("IDLE".to_string())),
    });
    
    // Create device state (separate for modularity)
    let device_state = web::Data::new(DeviceState {
        registry: device_registry.clone(),
    });
    
    // Create staking state
    let staking_state = web::Data::new(StakingState {
        manager: staking_manager.clone(),
    });
    
    // Create contract state
    let contract_state = web::Data::new(ContractState {
        runtime: wasm_runtime.clone(),
    });
    
    // Create governance state
    let governance_state: web::Data<GovernanceState> = web::Data::new(governance_manager.clone());

    // Create DEX state
    let dex_state = web::Data::new(DexState::new());
    info!("DEX initialized with default trading pairs");

    // Start P2P event handler
    if let Some(mut event_rx) = p2p_event_rx {
        let p2p_blockchain = blockchain.clone();
        let p2p_device_registry = device_registry.clone();
        tokio::spawn(async move {
            info!("P2P event handler started");
            while let Some(event) = event_rx.recv().await {
                match event {
                    NetworkEvent::PeerConnected(peer_id) => {
                        info!("P2P: Peer connected: {}", peer_id);
                    }
                    NetworkEvent::PeerDisconnected(peer_id) => {
                        info!("P2P: Peer disconnected: {}", peer_id);
                    }
                    NetworkEvent::NewTransaction(tx) => {
                        info!("P2P: Received transaction: {}", &tx.hash[..8]);
                        let mut chain = p2p_blockchain.write().await;
                        if let Err(e) = chain.add_transaction(tx) {
                            log::warn!("P2P: Transaction rejected: {}", e);
                        }
                    }
                    NetworkEvent::NewBlock(block) => {
                        info!("P2P: Received block #{}", block.index);
                        // TODO: Validate and add block from peer
                    }
                    NetworkEvent::NewContribution(contrib) => {
                        info!("P2P: Received contribution from {}", &contrib.device_id[..8]);
                        // Record contribution in device registry
                        let mut registry = p2p_device_registry.write().await;
                        if let Some(device) = registry.get_device_mut(&contrib.device_id) {
                            // Calculate quality score from contribution
                            let quality_score = 0.7; // Default quality, should be calculated
                            let points = 10.0; // Base points
                            device.record_contribution(quality_score, points);
                        }
                    }
                    NetworkEvent::Ready => {
                        info!("P2P: Network ready");
                    }
                }
            }
        });
    }
    
    // Start background mining task
    let mining_blockchain = blockchain.clone();
    let mining_validator = node_id.clone();
    let mining_p2p_tx = p2p_tx.clone();
    let mining_device_registry = device_registry.clone();
    let mining_staking = staking_manager.clone();
    let mining_governance = governance_manager.clone();
    
    tokio::spawn(async move {
        info!("Block producer started (10s fixed interval)");
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(10));
        let mut consecutive_errors: u32 = 0;
        
        loop {
            interval.tick().await;
            
            // Wrap the entire block production cycle in error handling
            // to prevent any single failure from killing the producer
            let result: Result<(), Box<dyn std::error::Error + Send + Sync>> = async {
                let mut chain = mining_blockchain.write().await;
                let current_height = chain.chain.len() as u64;
                
                // Update device activity status every 100 blocks
                if current_height % 100 == 0 {
                    let mut registry = mining_device_registry.write().await;
                    registry.update_activity_status(24);
                    let stats = registry.get_stats();
                    info!("Device Registry: {} total, {} active, {} regions", 
                        stats.total_devices, stats.active_devices, stats.regions_covered);
                    
                    let mut staking = mining_staking.write().await;
                    let completed = staking.process_unbonding();
                    if !completed.is_empty() {
                        info!("Processed {} unbonding entries", completed.len());
                    }
                    
                    let mut governance = mining_governance.write().await;
                    governance.process_expired_deposits();
                }
                
                // Disk usage monitoring every 60 blocks (~10 minutes)
                if current_height % 60 == 0 {
                    match check_disk_usage(DATA_DIR) {
                        Some((used_pct, used_gb, total_gb)) => {
                            if used_pct >= 90.0 {
                                error!("CRITICAL: Disk usage at {:.1}% ({:.2} GB / {:.2} GB) - immediate attention required!", 
                                    used_pct, used_gb, total_gb);
                            } else if used_pct >= 80.0 {
                                log::warn!("WARNING: Disk usage at {:.1}% ({:.2} GB / {:.2} GB) - consider expanding volume", 
                                    used_pct, used_gb, total_gb);
                            } else {
                                info!("Disk usage: {:.1}% ({:.2} GB / {:.2} GB)", used_pct, used_gb, total_gb);
                            }
                        }
                        None => {
                            log::warn!("Failed to read disk usage for {}", DATA_DIR);
                        }
                    }
                }
                
                // RocksDB compaction every 1000 blocks (~2.8 hours)
                if current_height > 0 && current_height % 1000 == 0 {
                    info!("Triggering scheduled RocksDB compaction at block {}", current_height);
                    chain.compact_storage();
                    if let Some(db_stats) = chain.get_db_stats() {
                        let live_mb = db_stats.total_live_data_bytes as f64 / (1024.0 * 1024.0);
                        info!("RocksDB stats after compaction: {:.1} MB live data, {} L0 files", 
                            live_mb, db_stats.level0_files);
                    }
                }
                
                // Cold storage migration every 5000 blocks (~14 hours)
                // Migrates old tx indexes from RocksDB to compressed archive files
                if current_height > 0 && current_height % 5000 == 0 {
                    info!("Checking cold storage migration at block {}", current_height);
                    let (migrated, _debug) = chain.migrate_cold_storage();
                    if migrated > 0 {
                        info!("Cold storage: {} tx indexes archived, running post-migration compaction", migrated);
                        chain.compact_storage();
                    }
                    if let Some(cs_stats) = chain.get_cold_storage_stats() {
                        info!("Cold storage stats: {} shards, {} entries, {:.1} MB, cutoff block {}",
                            cs_stats.total_shards, cs_stats.total_archived_entries,
                            cs_stats.total_archive_size_mb, cs_stats.cutoff_height);
                    }
                }
                
                // Distribute staking rewards every block
                {
                    let mut staking = mining_staking.write().await;
                    let block_reward = 100;
                    staking.distribute_rewards(block_reward);
                }
                
                // Collect pending transactions from mempool
                let mut mempool = MempoolManager::with_block_context(current_height);
                let pending_txs = mempool.collect_for_block(current_height);
                
                let mut added_count = 0;
                let mut failed_count = 0;
                for tx in pending_txs {
                    match chain.add_transaction(tx) {
                        Ok(_) => added_count += 1,
                        Err(e) => {
                            failed_count += 1;
                            log::warn!("Transaction rejected: {}", e);
                        }
                    }
                }
                if failed_count > 0 {
                    log::warn!("Block {}: {} tx rejected out of {}", current_height, failed_count, added_count + failed_count);
                }
                
                // Produce new block
                match chain.mine_block(mining_validator.clone()) {
                    Ok(block) => {
                        info!("Produced block #{} with {} transactions", 
                              block.index, block.transactions.len());
                        
                        let p2p_guard = mining_p2p_tx.read().await;
                        if let Some(ref tx) = *p2p_guard {
                            let _ = tx.send(NetworkCommand::BroadcastBlock(block.clone())).await;
                        }
                    },
                    Err(e) => {
                        log::warn!("Block production failed: {}", e);
                    }
                }
                
                Ok(())
            }.await;
            
            match result {
                Ok(_) => {
                    if consecutive_errors > 0 {
                        info!("Block producer recovered after {} consecutive errors", consecutive_errors);
                    }
                    consecutive_errors = 0;
                }
                Err(e) => {
                    consecutive_errors += 1;
                    error!("Block production cycle error (#{} consecutive): {}", consecutive_errors, e);
                    if consecutive_errors >= 10 {
                        error!("Block producer has failed {} times consecutively, but will keep retrying", consecutive_errors);
                    }
                    // Always continue - never exit the loop
                }
            }
        }
    });
    
    let bind_address = "0.0.0.0:8080";
    info!("Starting HTTP server at http://{}", bind_address);
    info!("API endpoints available at http://{}/api/", bind_address);
    info!("Device Registry API at http://{}/api/devices/", bind_address);
    info!("Staking API at http://{}/api/staking/", bind_address);
    info!("Smart Contracts API at http://{}/api/contracts/", bind_address);
    info!("Governance API at http://{}/api/governance/", bind_address);
    info!("DEX API at http://{}/api/dex/", bind_address);
    info!("Block Explorer available at http://{}/", bind_address);
    
    // Start HTTP server
    HttpServer::new(move || {
        // CORS configuration - restrict to known origins for security
        let cors = Cors::default()
            .allowed_origin("https://edgeai-alpha.vercel.app")
            .allowed_origin("https://edgeai-chain.github.io")
            .allowed_origin("https://edgeaiexplorer.org")
            .allowed_origin("https://www.edgeaiexplorer.org")
            .allowed_origin("https://edgeaiexplor-hg7rs66y.manus.space")
            .allowed_origin("http://localhost:3000")
            .allowed_origin("http://localhost:5173")
            .allowed_origin("http://127.0.0.1:3000")
            .allowed_origin("http://127.0.0.1:5173")
            .allowed_methods(vec!["GET", "POST", "PUT", "DELETE", "OPTIONS"])
            .allowed_headers(vec![header::CONTENT_TYPE, header::AUTHORIZATION, header::ACCEPT])
            .supports_credentials()
            .max_age(3600);
        
        App::new()
            .wrap(cors)
            .wrap(middleware::Logger::default())
            .app_data(app_state.clone())
            .app_data(device_state.clone())
            .app_data(staking_state.clone())
            .app_data(contract_state.clone())
            .app_data(governance_state.clone())
            .app_data(dex_state.clone())
            .configure(configure_routes)
            .configure(configure_wallet_routes)
            .configure(configure_data_routes)
            .configure(configure_device_routes)
            .configure(configure_staking_routes)
            .configure(configure_contract_routes)
            .configure(configure_governance_routes)
            .configure(|cfg| configure_dex_routes(cfg, dex_state.clone()))
            .service(Files::new("/", "./static").index_file("index.html"))
    })
    .bind(bind_address)?
    .run()
    .await
}
