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
use api::{AppState, configure_routes, configure_wallet_routes, configure_data_routes};

const DATA_DIR: &str = "/data";

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Initialize logger
    Builder::new()
        .filter_level(LevelFilter::Info)
        .format_timestamp_secs()
        .init();
    
    info!("===========================================");
    info!("   EdgeAI Blockchain Node v0.1.0");
    info!("   The Most Intelligent Data Chain");
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
    
    // Create app state
    let app_state = web::Data::new(AppState {
        blockchain: blockchain.clone(),
        consensus: consensus.clone(),
        marketplace: marketplace.clone(),
        network: network.clone(),
    });

    // Start background mining task
    let mining_blockchain = blockchain.clone();
    let mining_validator = node_id.clone();
    
    tokio::spawn(async move {
        info!("Block producer started");
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(10));
        
        loop {
            interval.tick().await;
            
            let mut chain = mining_blockchain.write().await;
            let current_height = chain.chain.len() as u64;
            
            // Collect pending transactions from mempool
            let mut mempool = MempoolManager::with_block_context(current_height);
            let batch_size = 3 + (current_height % 6) as usize;
            let pending_txs = mempool.collect_pending(batch_size);
            
            // Add collected transactions to chain
            let mut added_count = 0;
            let mut failed_count = 0;
            for tx in pending_txs {
                match chain.add_transaction(tx) {
                    Ok(_) => added_count += 1,
                    Err(e) => {
                        failed_count += 1;
                        log::debug!("Transaction rejected: {}", e);
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
