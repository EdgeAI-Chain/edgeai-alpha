//! Network module for EdgeAI Blockchain
//!
//! This module provides P2P networking capabilities using libp2p,
//! including peer discovery, message propagation, and network management.

pub mod p2p;
pub mod libp2p_network;

// Core network exports - only export what's actually used
pub use p2p::{NetworkManager, NodeType};
