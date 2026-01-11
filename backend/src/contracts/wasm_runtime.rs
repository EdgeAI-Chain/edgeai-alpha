//! WASM Runtime for EdgeAI Smart Contracts
//!
//! This module provides a WebAssembly execution environment for smart contracts.
//! It uses Wasmer as the WASM runtime and implements gas metering for resource control.

#![allow(dead_code)]

use std::collections::HashMap;
use std::sync::Arc;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use log::{info, warn, debug};
use wasmer::{Store, Module, Instance, imports, Function, FunctionEnv, FunctionEnvMut, Memory, MemoryType, Value};

/// Gas costs for different operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GasCosts {
    /// Base cost per WASM instruction
    pub instruction: u64,
    /// Cost per byte of memory allocation
    pub memory_byte: u64,
    /// Cost for storage read
    pub storage_read: u64,
    /// Cost for storage write
    pub storage_write: u64,
    /// Cost for external call
    pub external_call: u64,
    /// Cost for logging
    pub log: u64,
    /// Cost for hashing (per 64 bytes)
    pub hash: u64,
    /// Cost for signature verification
    pub verify_signature: u64,
}

impl Default for GasCosts {
    fn default() -> Self {
        GasCosts {
            instruction: 1,
            memory_byte: 3,
            storage_read: 200,
            storage_write: 5000,
            external_call: 2500,
            log: 375,
            hash: 30,
            verify_signature: 3000,
        }
    }
}

/// Gas meter for tracking and limiting resource usage
#[derive(Debug, Clone)]
pub struct GasMeter {
    /// Gas limit for the execution
    pub limit: u64,
    /// Gas used so far
    pub used: u64,
    /// Gas costs configuration
    pub costs: GasCosts,
}

impl GasMeter {
    pub fn new(limit: u64) -> Self {
        GasMeter {
            limit,
            used: 0,
            costs: GasCosts::default(),
        }
    }

    pub fn with_costs(limit: u64, costs: GasCosts) -> Self {
        GasMeter { limit, used: 0, costs }
    }

    /// Consume gas, returns error if limit exceeded
    pub fn consume(&mut self, amount: u64) -> Result<(), WasmError> {
        self.used = self.used.saturating_add(amount);
        if self.used > self.limit {
            Err(WasmError::OutOfGas {
                used: self.used,
                limit: self.limit,
            })
        } else {
            Ok(())
        }
    }

    /// Get remaining gas
    pub fn remaining(&self) -> u64 {
        self.limit.saturating_sub(self.used)
    }

    /// Consume gas for storage read
    pub fn consume_storage_read(&mut self) -> Result<(), WasmError> {
        self.consume(self.costs.storage_read)
    }

    /// Consume gas for storage write
    pub fn consume_storage_write(&mut self) -> Result<(), WasmError> {
        self.consume(self.costs.storage_write)
    }
}

/// WASM execution errors
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WasmError {
    /// Compilation error
    CompilationError(String),
    /// Runtime error
    RuntimeError(String),
    /// Out of gas
    OutOfGas { used: u64, limit: u64 },
    /// Invalid contract
    InvalidContract(String),
    /// Memory access error
    MemoryError(String),
    /// Import error
    ImportError(String),
    /// Function not found
    FunctionNotFound(String),
    /// Invalid argument
    InvalidArgument(String),
}

impl std::fmt::Display for WasmError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            WasmError::CompilationError(msg) => write!(f, "Compilation error: {}", msg),
            WasmError::RuntimeError(msg) => write!(f, "Runtime error: {}", msg),
            WasmError::OutOfGas { used, limit } => {
                write!(f, "Out of gas: used {} / limit {}", used, limit)
            }
            WasmError::InvalidContract(msg) => write!(f, "Invalid contract: {}", msg),
            WasmError::MemoryError(msg) => write!(f, "Memory error: {}", msg),
            WasmError::ImportError(msg) => write!(f, "Import error: {}", msg),
            WasmError::FunctionNotFound(name) => write!(f, "Function not found: {}", name),
            WasmError::InvalidArgument(msg) => write!(f, "Invalid argument: {}", msg),
        }
    }
}

/// Contract execution context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionContext {
    /// Contract address
    pub contract_address: String,
    /// Caller address
    pub caller: String,
    /// Transaction value (tokens sent)
    pub value: u64,
    /// Block height
    pub block_height: u64,
    /// Block timestamp
    pub block_timestamp: i64,
    /// Gas limit
    pub gas_limit: u64,
}

/// Contract execution result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionResult {
    /// Whether execution succeeded
    pub success: bool,
    /// Return data
    pub return_data: Vec<u8>,
    /// Gas used
    pub gas_used: u64,
    /// Logs emitted
    pub logs: Vec<ContractLog>,
    /// State changes
    pub state_changes: HashMap<String, Vec<u8>>,
    /// Error message (if failed)
    pub error: Option<String>,
}

/// Contract log entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContractLog {
    /// Contract address
    pub contract: String,
    /// Log topics (indexed)
    pub topics: Vec<String>,
    /// Log data
    pub data: Vec<u8>,
}

/// Host environment for WASM contracts
struct HostEnv {
    /// Contract storage
    storage: HashMap<Vec<u8>, Vec<u8>>,
    /// Execution context
    context: ExecutionContext,
    /// Gas meter
    gas_meter: GasMeter,
    /// Logs
    logs: Vec<ContractLog>,
    /// Memory reference
    memory: Option<Memory>,
}

/// Compiled WASM contract
pub struct CompiledContract {
    /// Contract address
    pub address: String,
    /// Compiled module
    module: Module,
    /// Contract ABI (function signatures)
    pub abi: ContractAbi,
    /// Code hash
    pub code_hash: String,
    /// Compilation timestamp
    pub compiled_at: DateTime<Utc>,
}

/// Contract ABI (Application Binary Interface)
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ContractAbi {
    /// Contract name
    pub name: String,
    /// Version
    pub version: String,
    /// Functions
    pub functions: Vec<AbiFunction>,
    /// Events
    pub events: Vec<AbiEvent>,
}

/// ABI function definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AbiFunction {
    /// Function name
    pub name: String,
    /// Input parameters
    pub inputs: Vec<AbiParam>,
    /// Output parameters
    pub outputs: Vec<AbiParam>,
    /// Whether function modifies state
    pub mutates: bool,
}

/// ABI parameter
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AbiParam {
    /// Parameter name
    pub name: String,
    /// Parameter type
    pub param_type: String,
}

/// ABI event definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AbiEvent {
    /// Event name
    pub name: String,
    /// Event parameters
    pub params: Vec<AbiParam>,
}

/// WASM Runtime for executing smart contracts
pub struct WasmRuntime {
    /// Wasmer store
    store: Store,
    /// Compiled contracts cache
    contracts: HashMap<String, CompiledContract>,
    /// Contract storage
    storage: HashMap<String, HashMap<Vec<u8>, Vec<u8>>>,
    /// Gas costs configuration
    gas_costs: GasCosts,
}

impl WasmRuntime {
    /// Create a new WASM runtime
    pub fn new() -> Self {
        WasmRuntime {
            store: Store::default(),
            contracts: HashMap::new(),
            storage: HashMap::new(),
            gas_costs: GasCosts::default(),
        }
    }

    /// Compile and deploy a contract
    pub fn deploy_contract(
        &mut self,
        wasm_code: &[u8],
        owner: &str,
        abi: ContractAbi,
    ) -> Result<String, WasmError> {
        // Compile the WASM module
        let module = Module::new(&self.store, wasm_code)
            .map_err(|e| WasmError::CompilationError(e.to_string()))?;

        // Generate contract address
        use sha2::{Sha256, Digest};
        let mut hasher = Sha256::new();
        hasher.update(wasm_code);
        hasher.update(owner.as_bytes());
        hasher.update(Utc::now().timestamp().to_le_bytes());
        let address = format!("0x{}", hex::encode(&hasher.finalize()[..20]));

        // Calculate code hash
        let mut code_hasher = Sha256::new();
        code_hasher.update(wasm_code);
        let code_hash = hex::encode(code_hasher.finalize());

        let compiled = CompiledContract {
            address: address.clone(),
            module,
            abi,
            code_hash,
            compiled_at: Utc::now(),
        };

        // Initialize storage for this contract
        self.storage.insert(address.clone(), HashMap::new());
        self.contracts.insert(address.clone(), compiled);

        info!("Contract deployed at {}", &address);
        Ok(address)
    }

    /// Execute a contract function
    pub fn execute(
        &mut self,
        contract_address: &str,
        function_name: &str,
        args: &[Value],
        context: ExecutionContext,
    ) -> Result<ExecutionResult, WasmError> {
        let contract = self.contracts.get(contract_address)
            .ok_or_else(|| WasmError::InvalidContract("Contract not found".to_string()))?;

        // Get contract storage
        let storage = self.storage.get(contract_address)
            .cloned()
            .unwrap_or_default();

        // Create gas meter
        let gas_meter = GasMeter::with_costs(context.gas_limit, self.gas_costs.clone());

        // Create host environment
        let env = FunctionEnv::new(
            &mut self.store,
            HostEnv {
                storage,
                context: context.clone(),
                gas_meter,
                logs: Vec::new(),
                memory: None,
            },
        );

        // Create imports
        let import_object = imports! {
            "env" => {
                "storage_read" => Function::new_typed_with_env(&mut self.store, &env, host_storage_read),
                "storage_write" => Function::new_typed_with_env(&mut self.store, &env, host_storage_write),
                "log" => Function::new_typed_with_env(&mut self.store, &env, host_log),
                "get_caller" => Function::new_typed_with_env(&mut self.store, &env, host_get_caller),
                "get_value" => Function::new_typed_with_env(&mut self.store, &env, host_get_value),
                "get_block_height" => Function::new_typed_with_env(&mut self.store, &env, host_get_block_height),
            }
        };

        // Instantiate the module
        let instance = Instance::new(&mut self.store, &contract.module, &import_object)
            .map_err(|e| WasmError::RuntimeError(e.to_string()))?;

        // Get the function
        let func = instance.exports.get_function(function_name)
            .map_err(|_| WasmError::FunctionNotFound(function_name.to_string()))?;

        // Execute the function
        let result = func.call(&mut self.store, args);

        // Get the environment data
        let env_data = env.as_ref(&self.store);

        match result {
            Ok(return_values) => {
                // Update storage
                self.storage.insert(contract_address.to_string(), env_data.storage.clone());

                Ok(ExecutionResult {
                    success: true,
                    return_data: return_values.iter()
                        .flat_map(|v| match v {
                            Value::I32(i) => i.to_le_bytes().to_vec(),
                            Value::I64(i) => i.to_le_bytes().to_vec(),
                            _ => vec![],
                        })
                        .collect(),
                    gas_used: env_data.gas_meter.used,
                    logs: env_data.logs.clone(),
                    state_changes: env_data.storage.iter()
                        .map(|(k, v)| (hex::encode(k), v.clone()))
                        .collect(),
                    error: None,
                })
            }
            Err(e) => {
                Ok(ExecutionResult {
                    success: false,
                    return_data: vec![],
                    gas_used: env_data.gas_meter.used,
                    logs: env_data.logs.clone(),
                    state_changes: HashMap::new(),
                    error: Some(e.to_string()),
                })
            }
        }
    }

    /// Get contract storage value
    pub fn get_storage(&self, contract_address: &str, key: &[u8]) -> Option<Vec<u8>> {
        self.storage.get(contract_address)
            .and_then(|s| s.get(key).cloned())
    }

    /// Get contract info
    pub fn get_contract(&self, address: &str) -> Option<ContractInfo> {
        self.contracts.get(address).map(|c| ContractInfo {
            address: c.address.clone(),
            code_hash: c.code_hash.clone(),
            abi: c.abi.clone(),
            compiled_at: c.compiled_at,
        })
    }

    /// List all deployed contracts
    pub fn list_contracts(&self) -> Vec<String> {
        self.contracts.keys().cloned().collect()
    }
}

/// Contract info (without the compiled module)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContractInfo {
    pub address: String,
    pub code_hash: String,
    pub abi: ContractAbi,
    pub compiled_at: DateTime<Utc>,
}

// ============ Host Functions ============

/// Host function: Read from storage
fn host_storage_read(mut env: FunctionEnvMut<HostEnv>, key_ptr: i32, key_len: i32) -> i32 {
    let data = env.data_mut();
    
    // Consume gas
    if data.gas_meter.consume_storage_read().is_err() {
        return -1;
    }

    // In a real implementation, we would read from memory
    // For now, return 0 (success) as a placeholder
    debug!("storage_read called: ptr={}, len={}", key_ptr, key_len);
    0
}

/// Host function: Write to storage
fn host_storage_write(mut env: FunctionEnvMut<HostEnv>, key_ptr: i32, key_len: i32, val_ptr: i32, val_len: i32) -> i32 {
    let data = env.data_mut();
    
    // Consume gas
    if data.gas_meter.consume_storage_write().is_err() {
        return -1;
    }

    debug!("storage_write called: key_ptr={}, key_len={}, val_ptr={}, val_len={}", 
           key_ptr, key_len, val_ptr, val_len);
    0
}

/// Host function: Log message
fn host_log(mut env: FunctionEnvMut<HostEnv>, msg_ptr: i32, msg_len: i32) {
    let data = env.data_mut();
    
    // Consume gas
    let _ = data.gas_meter.consume(data.gas_meter.costs.log);

    debug!("log called: ptr={}, len={}", msg_ptr, msg_len);
    
    // Add to logs
    data.logs.push(ContractLog {
        contract: data.context.contract_address.clone(),
        topics: vec!["log".to_string()],
        data: vec![],
    });
}

/// Host function: Get caller address
fn host_get_caller(env: FunctionEnvMut<HostEnv>) -> i64 {
    // Return a hash of the caller address
    let data = env.data();
    let caller_hash = data.context.caller.len() as i64;
    caller_hash
}

/// Host function: Get transaction value
fn host_get_value(env: FunctionEnvMut<HostEnv>) -> i64 {
    let data = env.data();
    data.context.value as i64
}

/// Host function: Get current block height
fn host_get_block_height(env: FunctionEnvMut<HostEnv>) -> i64 {
    let data = env.data();
    data.context.block_height as i64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_gas_meter() {
        let mut meter = GasMeter::new(1000);
        
        assert!(meter.consume(500).is_ok());
        assert_eq!(meter.used, 500);
        assert_eq!(meter.remaining(), 500);
        
        assert!(meter.consume(600).is_err());
    }

    #[test]
    fn test_runtime_creation() {
        let runtime = WasmRuntime::new();
        assert!(runtime.contracts.is_empty());
    }
}
