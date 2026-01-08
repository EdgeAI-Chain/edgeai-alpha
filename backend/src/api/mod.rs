pub mod rest;
pub mod wallet;

pub use rest::{AppState, configure_routes, ApiResponse};
pub use wallet::configure_wallet_routes;
