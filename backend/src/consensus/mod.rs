//! Consensus module for EdgeAI Blockchain
//! 
//! This module contains the Proof of Information Entropy (PoIE) consensus mechanism,
//! device registry for IoT device management, and data quality scoring algorithms.

pub mod poie;
pub mod device_registry;
pub mod data_quality;

// Core consensus exports
pub use poie::PoIEConsensus;

// Device registry exports - used in main.rs and api/device.rs
pub use device_registry::{DeviceRegistry, Device, DeviceType, GeoRegion};
