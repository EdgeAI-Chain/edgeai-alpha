---
sidebar_position: 1
---

# SDK Reference

Welcome to the EdgeAI TypeScript SDK Reference. This section provides a detailed breakdown of the SDK's components, including the main client, all data types, and utility functions.

This reference is intended for developers who want to understand the full capabilities of the SDK and integrate it deeply into their applications.

## Key Components

- **[EdgeAIClient](./client.md):** The main entry point for interacting with the SDK. It provides methods for all major API categories, including chain, staking, governance, and more.

- **[Type Definitions](./types.md):** A comprehensive list of all TypeScript types and interfaces used for request parameters and API responses. This ensures full type safety in your application.

- **[Utility Functions](./utils.md):** A collection of helper functions for common tasks such as unit conversion, address formatting, and data validation.

## Installation

If you haven't already, install the SDK using your favorite package manager:

```bash
npm install @edgeai/sdk
```

## Quick Start

Here is a quick example of how to use the SDK to query the chain:

```typescript
import { EdgeAIClient } from '@edgeai/sdk';

async function main() {
  const client = new EdgeAIClient({
    baseUrl: 'https://edgeai-blockchain-node.fly.dev',
  });

  const stats = await client.getChainStats();
  console.log('Current block height:', stats.height);
}

main();
```
