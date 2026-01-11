//! API module for EdgeAI Blockchain
//! 
//! This module provides RESTful API endpoints for blockchain operations,
//! wallet management, data marketplace, device registry, staking, and smart contracts.

pub mod rest;
pub mod wallet;
pub mod data;
pub mod device;
pub mod staking;
pub mod contracts;

// REST API exports
pub use rest::{AppState, configure_routes};

// Route configuration exports
pub use wallet::configure_wallet_routes;
pub use data::configure_data_routes;
pub use device::{DeviceState, configure_device_routes};
pub use staking::{StakingState, configure_staking_routes};
pub use contracts::{ContractState, configure_contract_routes};
