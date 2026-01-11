//! API module for EdgeAI Blockchain
//! 
//! This module provides RESTful API endpoints for blockchain operations,
//! wallet management, data marketplace, and device registry.

pub mod rest;
pub mod wallet;
pub mod data;
pub mod device;

// REST API exports
pub use rest::{AppState, configure_routes};

// Route configuration exports
pub use wallet::configure_wallet_routes;
pub use data::configure_data_routes;
pub use device::{DeviceState, configure_device_routes};
