// EdgeAI Blockchain - Cryptographic Module
// Provides wallet management and signature verification

pub mod wallet;

pub use wallet::{
    Wallet,
    WalletExport,
    WalletError,
    verify_signature,
    address_from_public_key,
};
