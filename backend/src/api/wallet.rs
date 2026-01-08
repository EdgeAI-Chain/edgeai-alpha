// EdgeAI Blockchain - Wallet API Endpoints
// Provides wallet creation, signing, and signed transaction submission

use actix_web::{web, HttpResponse, Responder};
use serde::{Deserialize, Serialize};
use log::info;
use sha2::{Sha256, Digest};

use crate::crypto::{Wallet, verify_signature, address_from_public_key};
use crate::blockchain::Transaction;
use super::rest::{AppState, ApiResponse};

// ============ Request/Response Types ============

#[derive(Debug, Serialize)]
pub struct WalletResponse {
    pub address: String,
    pub public_key: String,
    pub secret_key: String,
}

#[derive(Debug, Deserialize)]
pub struct ImportWalletRequest {
    pub secret_key: String,
}

#[derive(Debug, Deserialize)]
pub struct SignMessageRequest {
    pub secret_key: String,
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct SignatureResponse {
    pub message: String,
    pub signature: String,
    pub public_key: String,
}

#[derive(Debug, Deserialize)]
pub struct VerifySignatureRequest {
    pub public_key: String,
    pub message: String,
    pub signature: String,
}

#[derive(Debug, Serialize)]
pub struct VerifyResponse {
    pub valid: bool,
    pub address: String,
}

#[derive(Debug, Deserialize)]
pub struct SignedTransferRequest {
    pub from: String,
    pub to: String,
    pub amount: u64,
    pub public_key: String,
    pub signature: String,
}

#[derive(Debug, Deserialize)]
pub struct SignedDataContributionRequest {
    pub sender: String,
    pub data: String,
    pub public_key: String,
    pub signature: String,
}

#[derive(Debug, Deserialize)]
pub struct PrepareTransferRequest {
    pub from: String,
    pub to: String,
    pub amount: u64,
}

#[derive(Debug, Serialize)]
pub struct PreparedTransaction {
    pub from: String,
    pub to: String,
    pub amount: u64,
    pub message_to_sign: String,
}

#[derive(Debug, Deserialize)]
pub struct PrepareDataContributionRequest {
    pub sender: String,
    pub data: String,
}

#[derive(Debug, Serialize)]
pub struct PreparedDataContribution {
    pub sender: String,
    pub data_hash: String,
    pub message_to_sign: String,
}

// ============ Helper Functions ============

/// Create a deterministic message to sign for transfers
fn create_transfer_message(from: &str, to: &str, amount: u64) -> String {
    let data = format!("TRANSFER:{}:{}:{}", from, to, amount);
    let mut hasher = Sha256::new();
    hasher.update(data.as_bytes());
    hex::encode(hasher.finalize())
}

/// Create a deterministic message to sign for data contributions
fn create_data_contribution_message(sender: &str, data: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data.as_bytes());
    let data_hash = hex::encode(hasher.finalize());
    
    let message = format!("DATA_CONTRIBUTION:{}:{}", sender, data_hash);
    let mut hasher2 = Sha256::new();
    hasher2.update(message.as_bytes());
    hex::encode(hasher2.finalize())
}

// ============ Wallet Endpoints ============

/// Generate a new wallet (key pair)
pub async fn generate_wallet() -> impl Responder {
    let wallet = Wallet::new();
    
    info!("New wallet generated: {}", wallet.address());
    
    HttpResponse::Ok().json(ApiResponse::success(WalletResponse {
        address: wallet.address().to_string(),
        public_key: wallet.public_key_hex(),
        secret_key: wallet.secret_key_hex(),
    }))
}

/// Import wallet from secret key
pub async fn import_wallet(
    body: web::Json<ImportWalletRequest>,
) -> impl Responder {
    match Wallet::from_secret_key(&body.secret_key) {
        Ok(wallet) => {
            info!("Wallet imported: {}", wallet.address());
            HttpResponse::Ok().json(ApiResponse::success(WalletResponse {
                address: wallet.address().to_string(),
                public_key: wallet.public_key_hex(),
                secret_key: wallet.secret_key_hex(),
            }))
        }
        Err(e) => {
            HttpResponse::BadRequest().json(ApiResponse::<()>::error(&format!("Invalid secret key: {}", e)))
        }
    }
}

/// Get address from public key
pub async fn get_address_from_public_key(
    path: web::Path<String>,
) -> impl Responder {
    let public_key = path.into_inner();
    
    match address_from_public_key(&public_key) {
        Ok(address) => {
            #[derive(Serialize)]
            struct AddressResponse {
                public_key: String,
                address: String,
            }
            HttpResponse::Ok().json(ApiResponse::success(AddressResponse {
                public_key,
                address,
            }))
        }
        Err(e) => {
            HttpResponse::BadRequest().json(ApiResponse::<()>::error(&format!("Invalid public key: {}", e)))
        }
    }
}

/// Sign a message with secret key
pub async fn sign_message(
    body: web::Json<SignMessageRequest>,
) -> impl Responder {
    match Wallet::from_secret_key(&body.secret_key) {
        Ok(wallet) => {
            let signature = wallet.sign(body.message.as_bytes());
            
            HttpResponse::Ok().json(ApiResponse::success(SignatureResponse {
                message: body.message.clone(),
                signature,
                public_key: wallet.public_key_hex(),
            }))
        }
        Err(e) => {
            HttpResponse::BadRequest().json(ApiResponse::<()>::error(&format!("Invalid secret key: {}", e)))
        }
    }
}

/// Verify a signature
pub async fn verify_signature_endpoint(
    body: web::Json<VerifySignatureRequest>,
) -> impl Responder {
    match verify_signature(&body.public_key, body.message.as_bytes(), &body.signature) {
        Ok(valid) => {
            let address = address_from_public_key(&body.public_key)
                .unwrap_or_else(|_| "invalid".to_string());
            
            HttpResponse::Ok().json(ApiResponse::success(VerifyResponse {
                valid,
                address,
            }))
        }
        Err(e) => {
            HttpResponse::BadRequest().json(ApiResponse::<()>::error(&format!("Verification error: {}", e)))
        }
    }
}

/// Prepare a transfer transaction for signing (returns the message to sign)
pub async fn prepare_transfer(
    body: web::Json<PrepareTransferRequest>,
) -> impl Responder {
    let message_to_sign = create_transfer_message(&body.from, &body.to, body.amount);
    
    HttpResponse::Ok().json(ApiResponse::success(PreparedTransaction {
        from: body.from.clone(),
        to: body.to.clone(),
        amount: body.amount,
        message_to_sign,
    }))
}

/// Prepare a data contribution for signing
pub async fn prepare_data_contribution(
    body: web::Json<PrepareDataContributionRequest>,
) -> impl Responder {
    let message_to_sign = create_data_contribution_message(&body.sender, &body.data);
    
    let mut hasher = Sha256::new();
    hasher.update(body.data.as_bytes());
    let data_hash = hex::encode(hasher.finalize());
    
    HttpResponse::Ok().json(ApiResponse::success(PreparedDataContribution {
        sender: body.sender.clone(),
        data_hash,
        message_to_sign,
    }))
}

/// Submit a signed transfer transaction
pub async fn submit_signed_transfer(
    data: web::Data<AppState>,
    body: web::Json<SignedTransferRequest>,
) -> impl Responder {
    // Verify the address matches the public key
    let derived_address = match address_from_public_key(&body.public_key) {
        Ok(addr) => addr,
        Err(e) => {
            return HttpResponse::BadRequest()
                .json(ApiResponse::<()>::error(&format!("Invalid public key: {}", e)));
        }
    };
    
    if derived_address != body.from {
        return HttpResponse::BadRequest()
            .json(ApiResponse::<()>::error("Sender address does not match public key"));
    }
    
    // Recreate the message that should have been signed
    let expected_message = create_transfer_message(&body.from, &body.to, body.amount);
    
    // Verify the signature against the expected message
    match verify_signature(&body.public_key, expected_message.as_bytes(), &body.signature) {
        Ok(valid) => {
            if !valid {
                return HttpResponse::BadRequest()
                    .json(ApiResponse::<()>::error("Invalid signature"));
            }
        }
        Err(e) => {
            return HttpResponse::BadRequest()
                .json(ApiResponse::<()>::error(&format!("Signature verification error: {}", e)));
        }
    }
    
    // Create the signed transaction
    let tx = Transaction::transfer_signed(
        body.from.clone(),
        body.public_key.clone(),
        body.to.clone(),
        body.amount,
        body.signature.clone(),
    );
    
    // Add to blockchain
    let mut blockchain = data.blockchain.write().await;
    match blockchain.add_transaction(tx) {
        Ok(hash) => {
            info!("Signed transfer: {} -> {} ({} tokens)", 
                &body.from[..12.min(body.from.len())], 
                &body.to[..12.min(body.to.len())], 
                body.amount);
            HttpResponse::Ok().json(ApiResponse::success(hash))
        }
        Err(e) => HttpResponse::BadRequest().json(ApiResponse::<()>::error(&e)),
    }
}

/// Submit a signed data contribution transaction
pub async fn submit_signed_data_contribution(
    data: web::Data<AppState>,
    body: web::Json<SignedDataContributionRequest>,
) -> impl Responder {
    // Verify the address matches the public key
    let derived_address = match address_from_public_key(&body.public_key) {
        Ok(addr) => addr,
        Err(e) => {
            return HttpResponse::BadRequest()
                .json(ApiResponse::<()>::error(&format!("Invalid public key: {}", e)));
        }
    };
    
    if derived_address != body.sender {
        return HttpResponse::BadRequest()
            .json(ApiResponse::<()>::error("Sender address does not match public key"));
    }
    
    // Recreate the message that should have been signed
    let expected_message = create_data_contribution_message(&body.sender, &body.data);
    
    // Verify the signature against the expected message
    match verify_signature(&body.public_key, expected_message.as_bytes(), &body.signature) {
        Ok(valid) => {
            if !valid {
                return HttpResponse::BadRequest()
                    .json(ApiResponse::<()>::error("Invalid signature"));
            }
        }
        Err(e) => {
            return HttpResponse::BadRequest()
                .json(ApiResponse::<()>::error(&format!("Signature verification error: {}", e)));
        }
    }
    
    // Create the signed transaction
    let tx = Transaction::data_contribution_signed(
        body.sender.clone(),
        body.public_key.clone(),
        body.data.clone(),
        body.sender.clone(),
        body.signature.clone(),
    );
    
    let quality_score = tx.data_quality.as_ref()
        .map(|q| q.overall_score)
        .unwrap_or(0.0);
    
    // Add to blockchain
    let mut blockchain = data.blockchain.write().await;
    match blockchain.add_transaction(tx) {
        Ok(hash) => {
            info!("Signed data contribution: {} (quality: {:.2})", 
                &body.sender[..12.min(body.sender.len())], quality_score);
            
            #[derive(Serialize)]
            struct ContributionResponse {
                tx_hash: String,
                quality_score: f64,
            }
            
            HttpResponse::Ok().json(ApiResponse::success(ContributionResponse {
                tx_hash: hash,
                quality_score,
            }))
        }
        Err(e) => HttpResponse::BadRequest().json(ApiResponse::<()>::error(&e)),
    }
}

// ============ Router Configuration ============

pub fn configure_wallet_routes(cfg: &mut web::ServiceConfig) {
    cfg
        // Wallet management
        .route("/api/wallet/generate", web::post().to(generate_wallet))
        .route("/api/wallet/import", web::post().to(import_wallet))
        .route("/api/wallet/address/{public_key}", web::get().to(get_address_from_public_key))
        
        // Signing
        .route("/api/wallet/sign", web::post().to(sign_message))
        .route("/api/wallet/verify", web::post().to(verify_signature_endpoint))
        
        // Signed transactions
        .route("/api/wallet/prepare-transfer", web::post().to(prepare_transfer))
        .route("/api/wallet/prepare-contribute", web::post().to(prepare_data_contribution))
        .route("/api/wallet/transfer", web::post().to(submit_signed_transfer))
        .route("/api/wallet/contribute", web::post().to(submit_signed_data_contribution));
}
