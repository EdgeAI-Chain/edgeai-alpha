pub mod rest;
pub mod wallet;
pub mod data;

pub use rest::{AppState, configure_routes, ApiResponse};
pub use wallet::configure_wallet_routes;
pub use data::configure_data_routes;
