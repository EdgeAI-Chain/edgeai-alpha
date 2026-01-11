---
sidebar_position: 3
---

# Guide: Deploying Smart Contracts

EdgeAI supports smart contracts written in any language that can be compiled to WebAssembly (WASM). This provides developers with a high degree of flexibility and power. Rust is the most well-supported language for writing EdgeAI smart contracts.

This guide will walk you through the basic steps of deploying a WASM smart contract to the EdgeAI network.

## Prerequisites

-   **Rust and Cargo:** Ensure you have the Rust toolchain installed.
-   **WASM Target:** Add the WASM compilation target for Rust:
    ```bash
    rustup target add wasm32-unknown-unknown
    ```
-   **EdgeAI SDK:** You'll need the SDK to interact with the network.

## Step 1: Write Your Smart Contract

Here is a simple "hello world" style contract written in Rust. It stores a greeting message and allows it to be updated.

```rust
// In your new Rust library project (lib.rs)
#![no_std]

use borsh::{BorshDeserialize, BorshSerialize};

#[derive(BorshSerialize, BorshDeserialize, Default)]
struct HelloWorld {
    greeting: String,
}

#[no_mangle]
pub extern "C" fn init() {
    let mut contract = HelloWorld::default();
    contract.greeting = "Hello, World!".to_string();
    // Save contract state
}

#[no_mangle]
pub extern "C" fn get_greeting() -> String {
    // Load contract state
    let contract: HelloWorld = unimplemented!(); // Load state from storage
    contract.greeting
}

#[no_mangle]
pub extern "C" fn set_greeting(new_greeting: String) {
    // Load contract state
    let mut contract: HelloWorld = unimplemented!(); // Load state from storage
    contract.greeting = new_greeting;
    // Save contract state
}
```

*Note: This is a simplified example. A real contract would use a framework to handle state management and serialization.* 

## Step 2: Compile to WASM

Compile your Rust project to the `wasm32-unknown-unknown` target.

```bash
cargo build --target wasm32-unknown-unknown --release
```

The compiled WASM file will be located at `target/wasm32-unknown-unknown/release/your_project_name.wasm`.

## Step 3: Deploy the Contract

To deploy the contract, you need to read the WASM file, encode it as a hex string, and send it in a `deployContract` transaction.

```typescript
import { EdgeAIClient } from '@edgeai/sdk';
import * as fs from 'fs/promises';

const client = new EdgeAIClient({ baseUrl: '...' });

async function deployContract(wasmPath: string) {
  // Read the WASM bytecode
  const wasmBuffer = await fs.readFile(wasmPath);
  // Convert to hex string
  const wasmHex = `0x${wasmBuffer.toString('hex')}`;

  // Send the deployment transaction (simplified example)
  const txHash = await wallet.deployContract({
    code: wasmHex,
    args: [], // No constructor arguments in this example
  });

  console.log(`Contract deployment transaction sent: ${txHash}`);
  // You will need to wait for the transaction to be confirmed
  // and then get the contract address from the receipt.
}
```

## Step 4: Interact with the Contract

Once the contract is deployed and you have its address, you can call its functions.

### Calling a Read-Only Function

For functions that don't change the state (like `get_greeting`), you can use a `queryContract` call, which doesn't consume gas.

```typescript
async function readGreeting(contractAddress: string) {
  const result = await client.queryContract({
    contract: contractAddress,
    function: 'get_greeting',
    args: [],
  });

  console.log(`The current greeting is: ${result}`);
}
```

### Calling a State-Changing Function

For functions that modify the state (like `set_greeting`), you must send a transaction.

```typescript
// Simplified example
async function updateGreeting(contractAddress: string, newGreeting: string) {
  const txHash = await wallet.callContract({
    contract: contractAddress,
    function: 'set_greeting',
    args: [newGreeting],
  });

  console.log(`Update transaction sent: ${txHash}`);
}
```

This guide provides a high-level overview. Developing and deploying robust smart contracts requires careful attention to security, gas optimization, and state management.
