# @edgeai/sdk

Official JavaScript/TypeScript SDK for the EdgeAI Blockchain. This SDK provides a simple and intuitive interface for interacting with EdgeAI nodes, managing accounts, staking, smart contracts, and IoT devices.

## Installation

```bash
npm install @edgeai/sdk
# or
yarn add @edgeai/sdk
# or
pnpm add @edgeai/sdk
```

## Quick Start

```typescript
import { EdgeAIClient, formatEdge } from '@edgeai/sdk';

// Create a client instance
const client = new EdgeAIClient({
  baseUrl: 'https://edgeai-blockchain-node.fly.dev',
});

// Get chain statistics
const stats = await client.getChainStats();
console.log(`Block height: ${stats.height}`);
console.log(`TPS: ${stats.tps}`);
```

## Features

The SDK provides comprehensive access to all EdgeAI blockchain functionality.

### Chain & Block Operations

Query blockchain state, retrieve blocks, and monitor network activity.

```typescript
// Get chain stats
const stats = await client.getChainStats();

// Get latest block
const block = await client.getLatestBlock();

// Get block by height
const block100 = await client.getBlock(100);

// Get recent blocks with pagination
const blocks = await client.getBlocks({ page: 1, pageSize: 10 });
```

### Account Management

Manage accounts, check balances, and track transaction history.

```typescript
// Get account info
const account = await client.getAccount('0x...');
console.log(`Balance: ${formatEdge(account.balance)} EDGE`);

// Get detailed balance breakdown
const balance = await client.getAccountBalance('0x...');
console.log(`Available: ${formatEdge(balance.available)}`);
console.log(`Staked: ${formatEdge(balance.staked)}`);
console.log(`Delegated: ${formatEdge(balance.delegated)}`);

// Get account transactions
const txs = await client.getAccountTransactions('0x...', { page: 1 });
```

### Staking & Delegation

Participate in network consensus through staking and delegation.

```typescript
// Get staking statistics
const stakingStats = await client.getStakingStats();
console.log(`Total staked: ${formatEdge(stakingStats.totalStaked)}`);
console.log(`APY: ${stakingStats.currentApy}%`);

// Get all validators
const validators = await client.getValidators();
for (const v of validators.items) {
  console.log(`${v.name}: ${v.votingPower}% voting power`);
}

// Get delegations for an account
const delegations = await client.getDelegations('0x...');
```

### Smart Contracts

Deploy and interact with WASM smart contracts.

```typescript
// Get contract info
const contract = await client.getContract('0x...');

// List all contracts
const contracts = await client.getContracts();

// Read contract storage
const storage = await client.readContractStorage('0x...', 'balance');
```

### IoT Device Management

Register and manage edge computing devices.

```typescript
import { DeviceType } from '@edgeai/sdk';

// Get device statistics
const deviceStats = await client.getDeviceStats();
console.log(`Total devices: ${deviceStats.totalDevices}`);
console.log(`Active: ${deviceStats.activeDevices}`);

// Get device by ID
const device = await client.getDevice('DEV_123...');

// Get devices by owner
const myDevices = await client.getDevicesByOwner('0x...');
```

## Utility Functions

The SDK includes helpful utility functions for common operations.

```typescript
import {
  toSmallestUnit,
  fromSmallestUnit,
  formatEdge,
  isValidAddress,
  shortenAddress,
  formatRelativeTime,
} from '@edgeai/sdk';

// Convert between units
const wei = toSmallestUnit(100);      // "100000000000000000000"
const edge = fromSmallestUnit(wei);   // "100"

// Format for display
const display = formatEdge('1234567890000000000000', 2); // "1,234.57"

// Validate and format addresses
isValidAddress('0x1234...'); // true/false
shortenAddress('0x1234567890abcdef...'); // "0x1234...cdef"

// Format timestamps
formatRelativeTime(new Date()); // "5 minutes ago"
```

## Configuration Options

The client accepts the following configuration options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `baseUrl` | string | required | Base URL of the EdgeAI node |
| `timeout` | number | 30000 | Request timeout in milliseconds |
| `apiKey` | string | undefined | API key for authenticated requests |
| `debug` | boolean | false | Enable debug logging |

```typescript
const client = new EdgeAIClient({
  baseUrl: 'https://edgeai-blockchain-node.fly.dev',
  timeout: 60000,
  apiKey: 'your-api-key',
  debug: true,
});
```

## Error Handling

The SDK throws `EdgeAIHttpError` for API errors.

```typescript
import { EdgeAIClient, EdgeAIHttpError } from '@edgeai/sdk';

try {
  const account = await client.getAccount('invalid-address');
} catch (error) {
  if (error instanceof EdgeAIHttpError) {
    console.error(`API Error: ${error.message}`);
    console.error(`Status: ${error.statusCode}`);
    console.error(`Code: ${error.errorCode}`);
  }
}
```

## TypeScript Support

The SDK is written in TypeScript and provides full type definitions for all methods and responses.

```typescript
import type {
  Block,
  Transaction,
  Validator,
  Device,
  ChainStats,
} from '@edgeai/sdk';

// All responses are fully typed
const block: Block = await client.getLatestBlock();
const stats: ChainStats = await client.getChainStats();
```

## Requirements

The SDK requires Node.js 18.0.0 or higher and works in both Node.js and browser environments.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Links

- [EdgeAI Website](https://edgeai.network)
- [GitHub Repository](https://github.com/EdgeAI-Chain/edgeai-alpha)
- [API Documentation](https://docs.edgeai.network)
