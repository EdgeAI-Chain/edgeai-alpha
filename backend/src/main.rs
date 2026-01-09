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

use blockchain::{Blockchain, TransactionSimulator};
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
        info!("Background mining task started with transaction simulation");
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(10));
        
        loop {
            interval.tick().await;
            
            let mut chain = mining_blockchain.write().await;
            
            // Get current block index for deterministic simulation
            let current_index = chain.chain.len() as u64;
            
            // Generate simulated IoT transactions (3-8 per block)
            let mut simulator = TransactionSimulator::from_block_index(current_index);
            let tx_count = 3 + (current_index % 6) as usize; // 3-8 transactions
            let simulated_txs = simulator.generate_transactions(tx_count);
            
            // Add simulated transactions to pending pool
            for tx in simulated_txs {
                if let Err(e) = chain.add_transaction(tx) {
                    log::debug!("Simulated tx rejected: {}", e);
                }
            }
            
            // Mine block with all pending transactions
            match chain.mine_block(mining_validator.clone()) {
                Ok(block) => {
                    info!("Auto-mined block #{} with {} txs (including {} simulated)", 
                          block.index, block.transactions.len(), tx_count);
                },
                Err(e) => {
                    log::warn!("Mining failed: {}", e);
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
