---
sidebar_position: 2
---

# EdgeAIClient

The `EdgeAIClient` is the primary interface for interacting with the EdgeAI blockchain. It provides a comprehensive set of methods to query the chain, manage accounts, participate in staking and governance, and interact with smart contracts and IoT devices.

## Initialization

To use the client, you must first create an instance with the base URL of an EdgeAI node.

```typescript
import { EdgeAIClient } from '@edgeai/sdk';

const client = new EdgeAIClient({
  baseUrl: 'https://edgeai-blockchain-node.fly.dev',
});
```

### Configuration

The client constructor accepts a configuration object with the following options:

| Option    | Type   | Description                               |
| :-------- | :----- | :---------------------------------------- |
| `baseUrl` | string | **Required.** The base URL of the EdgeAI node API. |
| `timeout` | number | Request timeout in milliseconds (default: 30000). |
| `apiKey`  | string | An optional API key for authenticated endpoints. |
| `debug`   | boolean| Set to `true` to enable debug logging to the console. |

## Methods

This is a summary of the available methods on the `EdgeAIClient` instance.

### Chain Methods

- `getChainStats(): Promise<ChainStats>`
- `getNetworkInfo(): Promise<NetworkInfo>`
- `getMempoolStats(): Promise<MempoolStats>`
- `getBlock(height: number): Promise<Block>`
- `getLatestBlock(): Promise<Block>`
- `getBlocks(params?: PaginationParams): Promise<PaginatedResponse<BlockSummary>>`

### Transaction Methods

- `getTransaction(hash: string): Promise<Transaction>`
- `getTransactionReceipt(hash: string): Promise<TransactionReceipt>`
- `getTransactions(params?: PaginationParams): Promise<PaginatedResponse<Transaction>>`
- `broadcastTransaction(signedTx: SignedTransaction): Promise<string>`

### Account Methods

- `getAccount(address: string): Promise<Account>`
- `getAccountBalance(address: string): Promise<AccountBalance>`
- `getAccountTransactions(address: string, params?: PaginationParams): Promise<PaginatedResponse<Transaction>>`

### Staking Methods

- `getStakingStats(): Promise<StakingStats>`
- `getValidators(params?: { status?: ValidatorStatus } & PaginationParams): Promise<PaginatedResponse<Validator>>`
- `getValidator(address: string): Promise<Validator>`
- `getDelegations(address: string): Promise<Delegation[]>`
- `getUnbondingEntries(address: string): Promise<UnbondingEntry[]>`

### Governance Methods

- `getGovernanceStats(): Promise<GovernanceStats>`
- `getProposals(params?: { status?: ProposalStatus } & PaginationParams): Promise<PaginatedResponse<Proposal>>`
- `getProposal(id: number): Promise<Proposal>`
- `getProposalVotes(id: number): Promise<ProposalVote[]>`

### Smart Contract Methods

- `getContract(address: string): Promise<Contract>`
- `getContracts(params?: PaginationParams): Promise<PaginatedResponse<Contract>>`
- `readContractStorage(address: string, key: string): Promise<any>`
- `queryContract(params: CallContractParams): Promise<ContractCallResult>`

### Device Methods

- `getDeviceStats(): Promise<DeviceStats>`
- `getDevice(id: string): Promise<Device>`
- `getDevices(params?: { owner?: string; deviceType?: DeviceType } & PaginationParams): Promise<PaginatedResponse<Device>>`
- `getDevicesByOwner(ownerAddress: string): Promise<Device[]>`
