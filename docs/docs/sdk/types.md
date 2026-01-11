---
sidebar_position: 3
---

# Type Definitions

The EdgeAI SDK is written in TypeScript and provides comprehensive type definitions for all API responses and request parameters. This ensures a high-quality developer experience with full type-checking and autocompletion.

Below is a selection of the most important types. For a complete list, please refer to the source code.

## Core Types

### `EdgeAIConfig`
Configuration object for the `EdgeAIClient`.

```typescript
export interface EdgeAIConfig {
  baseUrl: string;
  timeout?: number;
  apiKey?: string;
  debug?: boolean;
}
```

### `PaginatedResponse<T>`
A generic wrapper for API responses that return a list of items with pagination.

```typescript
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
```

## Blockchain Types

### `Block`
Represents a full block on the blockchain.

```typescript
export interface Block {
  index: number;
  header: BlockHeader;
  transactions: Transaction[];
  hash: string;
  validator: string;
}
```

### `Transaction`
Represents a transaction on the network.

```typescript
export interface Transaction {
  hash: string;
  type: TransactionType;
  from: string;
  to: string;
  amount: string;
  fee: string;
  nonce: number;
  timestamp: string;
  signature: string;
  data?: string;
  status: TransactionStatus;
}
```

## Staking & Governance Types

### `Validator`
Represents a network validator.

```typescript
export interface Validator {
  address: string;
  name: string;
  description: string;
  totalStake: string;
  commission: number;
  status: ValidatorStatus;
  uptime: number;
  votingPower: number;
}
```

### `Proposal`
Represents a governance proposal.

```typescript
export interface Proposal {
  id: number;
  proposer: string;
  title: string;
  description: string;
  proposalType: string;
  status: ProposalStatus;
  deposit: string;
  createdAt: string;
  votes: {
    yes: string;
    no: string;
    abstain: string;
    noWithVeto: string;
  };
}
```

## Device Types

### `Device`
Represents a registered IoT device.

```typescript
export interface Device {
  id: string;
  owner: string;
  deviceType: DeviceType;
  name: string;
  reputation: number;
  contributions: number;
  isActive: boolean;
}
```
