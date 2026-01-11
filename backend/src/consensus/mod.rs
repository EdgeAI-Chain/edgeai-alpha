//! Consensus module for EdgeAI Blockchain
//! 
//! This module contains the Proof of Information Entropy (PoIE) consensus mechanism,
//! device registry for IoT device management, data quality scoring algorithms,
//! and enhanced staking system with delegation and slashing.

pub mod poie;
pub mod device_registry;
pub mod data_quality;
pub mod staking;

// Core consensus exports
pub use poie::PoIEConsensus;

// Device registry exports - used in main.rs and api/device.rs
pub use device_registry::{DeviceRegistry, Device, DeviceType, GeoRegion};

// Staking exports
pub use staking::{
    StakingManager, StakingConfig, StakingValidator, ValidatorStatus,
    ValidatorDescription, Delegation, UnbondingEntry, SlashEvent, SlashReason,
    StakingStats,
};
