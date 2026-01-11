---
sidebar_position: 3
---

# Using the EdgeAI SDK

The EdgeAI TypeScript SDK provides a powerful and convenient way to interact with the EdgeAI blockchain from your JavaScript or TypeScript applications. It works in both Node.js and browser environments.

## Installation

Install the SDK using your preferred package manager:

```bash
npm install @edgeai/sdk
```

Or with Yarn:

```bash
yarn add @edgeai/sdk
```

Or with pnpm:

```bash
pnpm add @edgeai/sdk
```

## Initializing the Client

To get started, you need to create an instance of the `EdgeAIClient`. At a minimum, you must provide the `baseUrl` of an EdgeAI node.

```typescript
import { EdgeAIClient } from '@edgeai/sdk';

// Connect to the public testnet node
const client = new EdgeAIClient({
  baseUrl: 'https://edgeai-blockchain-node.fly.dev',
});

// Or connect to a local node
const localClient = new EdgeAIClient({
  baseUrl: 'http://localhost:8080',
});
```

## Core Concepts

The SDK is designed to be intuitive and mirrors the structure of the EdgeAI blockchain's API.

### Querying the Chain

You can easily fetch real-time information about the blockchain.

```typescript
async function getChainInfo() {
  // Get high-level chain statistics
  const stats = await client.getChainStats();
  console.log(`Current Block Height: ${stats.height}`);
  console.log(`Transactions per Second: ${stats.tps}`);

  // Get the most recent block
  const latestBlock = await client.getLatestBlock();
  console.log(`Latest Block Hash: ${latestBlock.hash}`);

  // Get a specific block by its height
  const block100 = await client.getBlock(100);
  console.log(`Validator for Block 100: ${block100.validator}`);
}
```

### Interacting with Accounts

Check account balances, transaction history, and staking information.

```typescript
import { formatEdge } from '@edgeai/sdk';

async function getAccountInfo(address: string) {
  // Get general account information
  const account = await client.getAccount(address);
  console.log(`Balance: ${formatEdge(account.balance)} EDGE`);

  // Get a detailed breakdown of an account's balance
  const balanceDetails = await client.getAccountBalance(address);
  console.log(`Staked Amount: ${formatEdge(balanceDetails.staked)} EDGE`);
  console.log(`Pending Rewards: ${formatEdge(balanceDetails.rewards)} EDGE`);

  // Get the transaction history for an account
  const transactions = await client.getAccountTransactions(address, { pageSize: 5 });
  console.log(`Last 5 Transactions:`, transactions.items);
}
```

### Staking and Governance

The SDK provides full support for participating in staking and on-chain governance.

```typescript
async function getStakingInfo() {
  // Get network-wide staking statistics
  const stakingStats = await client.getStakingStats();
  console.log(`Total Staked: ${formatEdge(stakingStats.totalStaked)} EDGE`);
  console.log(`Current APY: ${stakingStats.currentApy}%`);

  // Get the list of active validators
  const validators = await client.getValidators({ page: 1, pageSize: 10 });
  console.log('Top 10 Validators:', validators.items.map(v => v.name));

  // Get governance proposals
  const proposals = await client.getProposals();
  console.log(`Active Proposals:`, proposals.items.filter(p => p.status === 'Voting'));
}
```

## Utility Functions

The SDK includes a suite of utility functions to help with common tasks like unit conversion, address formatting, and time formatting.

```typescript
import {
  toSmallestUnit,
  fromSmallestUnit,
  formatEdge,
  isValidAddress,
  shortenAddress,
} from '@edgeai/sdk';

// Convert between the base unit (EDGE) and the smallest unit (wie)
const wieValue = toSmallestUnit('1.5'); // '1500000000000000000'
const edgeValue = fromSmallestUnit(wieValue); // '1.5'

// Format amounts for display
const formattedBalance = formatEdge('1234567890000000000000', 2); // "1,234.57"

// Validate an address
const isValid = isValidAddress('0x123...'); // true or false

// Shorten an address for UI display
const shortAddr = shortenAddress('0x1234567890abcdef1234567890abcdef12345678'); // "0x1234...5678"
```

## Next Steps

- **[API Reference](../api-reference/authentication.md):** Dive into the detailed API documentation.
- **[SDK Reference](../sdk/sdk-reference.md):** Explore the full SDK reference for advanced usage.
- **[Guides](../guides/staking-and-delegation.md):** Follow our guides to perform specific tasks like staking, voting, and deploying smart contracts.
