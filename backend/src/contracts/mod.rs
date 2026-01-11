//! Smart Contracts module for EdgeAI Blockchain
//!
//! This module provides smart contract functionality including:
//! - Contract definitions and state management
//! - WASM runtime for contract execution
//! - Gas metering and resource control
//!
//! NOTE: Smart contract execution is currently in development.
//! The WASM runtime provides a secure sandbox for contract execution.

pub mod smart_contract;
pub mod wasm_runtime;

// Re-export commonly used types
pub use smart_contract::{SmartContract, ContractType, ContractState};
pub use wasm_runtime::{
    WasmRuntime, WasmError, ExecutionContext, ExecutionResult,
    ContractAbi, AbiFunction, AbiParam, AbiEvent, ContractInfo,
    GasMeter, GasCosts,
};
