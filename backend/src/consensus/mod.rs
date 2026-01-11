//! Consensus module for EdgeAI Blockchain
//! 
//! This module contains the Proof of Information Entropy (PoIE) consensus mechanism,
//! device registry for IoT device management, data quality scoring algorithms,
//! enhanced staking system with delegation and slashing, and on-chain governance.

pub mod poie;
pub mod device_registry;
pub mod data_quality;
pub mod staking;
pub mod governance;

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

// Governance exports
pub use governance::{
    GovernanceManager, GovernanceConfig, GovernanceStats,
    Proposal, ProposalType, ProposalStatus, VoteOption, VoteTally,
};
