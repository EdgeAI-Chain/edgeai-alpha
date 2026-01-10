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
use actix_files::Files;
use log::{info, LevelFilter};
use env_logger::Builder;
use std::fs;
use std::path::Path;

use blockchain::{Blockchain, MempoolManager};
use consensus::PoIEConsensus;
use data_market::DataMarketplace;
use network::{NetworkManager, NodeType};
use network::libp2p_network::{NetworkConfig, NetworkCommand, NetworkEvent, start_p2p_network};
use api::{AppState, configure_routes, configure_wallet_routes, configure_data_routes};

const DATA_DIR: &str = "/data";

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Initialize logger
    Builder::new()
        .filter_level(LevelFilter::Info)
        .format_timestamp_secs()
        .init();
    
   info!("============================================");
    info!("   EdgeAI Blockchain Node v0.2.0");
    info!("   The Most Intelligent Data Chain");
    info!("   Now with libp2p P2P Networking!");
    info!("===========================================");
    
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
    
    // Initialize marketplace
    let marketplace = Arc::new(RwLock::new(DataMarketplace::new()));
    info!("Data marketplace initialized");
    
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
    });

    // Start P2P event handler
    if let Some(mut event_rx) = p2p_event_rx {
        let p2p_blockchain = blockchain.clone();
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
    
    tokio::spawn(async move {
        info!("Block producer started");
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(10));
        
        loop {
            interval.tick().await;
            
            let mut chain = mining_blockchain.write().await;
            let current_height = chain.chain.len() as u64;
            
            // Collect pending transactions from mempool
            let mut mempool = MempoolManager::with_block_context(current_height);
            // Phase 1: Generate 100-150 transactions per block for 1000 device network
            // Target: 10-15 TPS with 10-second block interval
            let batch_size = 100 + (current_height % 51) as usize;
            let pending_txs = mempool.collect_pending(batch_size);
            info!("Generated {} transactions from mempool for block {}", pending_txs.len(), current_height);
            
            // Add collected transactions to chain
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
            if added_count > 0 || failed_count > 0 {
                info!("Mempool: {} transactions added, {} rejected", added_count, failed_count);
            }
            
            // Produce new block
            match chain.mine_block(mining_validator.clone()) {
                Ok(block) => {
                    info!("Produced block #{} with {} transactions", 
                          block.index, block.transactions.len());
                    
                    // Broadcast block to P2P network
                    let p2p_guard = mining_p2p_tx.read().await;
                    if let Some(ref tx) = *p2p_guard {
                        let _ = tx.send(NetworkCommand::BroadcastBlock(block.clone())).await;
                    }
                },
                Err(e) => {
                    log::warn!("Block production failed: {}", e);
                }
            }
        }
    });
    
    let bind_address = "0.0.0.0:8080";
    info!("Starting HTTP server at http://{}", bind_address);
    info!("API endpoints available at http://{}/api/", bind_address);
    info!("Block Explorer available at http://{}/", bind_address);
    
    // Start HTTP server
    HttpServer::new(move || {
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header()
            .max_age(3600);
        
        App::new()
            .wrap(cors)
            .wrap(middleware::Logger::default())
            .app_data(app_state.clone())
            .configure(configure_routes)
            .configure(configure_wallet_routes)
            .configure(configure_data_routes)
            .service(Files::new("/", "./static").index_file("index.html"))
    })
    .bind(bind_address)?
    .run()
    .await
}
