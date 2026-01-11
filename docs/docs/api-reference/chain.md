---
sidebar_position: 2
---

# Chain API

The Chain API provides endpoints for querying the state of the EdgeAI blockchain, including network statistics, block information, and transaction data.

## Get Chain Statistics

Retrieves high-level statistics about the blockchain network.

`GET /api/chain/stats`

### Response

```json
{
  "height": 123456,
  "totalTransactions": 987654,
  "activeAccounts": 54321,
  "networkEntropy": 0.987,
  "tps": 15.6
}
```

| Field | Type | Description |
| :--- | :--- | :--- |
| `height` | number | The current block height of the chain. |
| `totalTransactions` | number | The total number of transactions processed since genesis. |
| `activeAccounts` | number | The number of accounts with activity in the last 24 hours. |
| `networkEntropy` | number | A measure of the network's data diversity (PoIE metric). |
| `tps` | number | The current average transactions per second. |

### SDK Usage

```typescript
const stats = await client.getChainStats();
console.log(`Current height: ${stats.height}`);
```

## Get Block by Height

Retrieves a full block by its height (index).

`GET /api/blocks/{height}`

### Parameters

| Name | In | Type | Description |
| :--- | :--- | :--- | :--- |
| `height` | path | integer | The height of the block to retrieve. |

### Response

A full [Block object](../sdk/types.md#block).

### SDK Usage

```typescript
const block = await client.getBlock(12345);
console.log(`Block hash: ${block.hash}`);
```

## Get Latest Block

Retrieves the most recent block on the chain.

`GET /api/blocks/latest`

### Response

A full [Block object](../sdk/types.md#block).

### SDK Usage

```typescript
const latestBlock = await client.getLatestBlock();
console.log(`Latest block validator: ${latestBlock.validator}`);
```

## Get Blocks (Paginated)

Retrieves a paginated list of recent block summaries.

`GET /api/blocks`

### Query Parameters

| Name | Type | Description |
| :--- | :--- | :--- |
| `page` | integer | The page number to retrieve (default: 1). |
| `pageSize` | integer | The number of blocks per page (default: 20). |

### Response

A [PaginatedResponse](../sdk/types.md#paginatedresponse) containing a list of [BlockSummary](../sdk/types.md#blocksummary) objects.

### SDK Usage

```typescript
const recentBlocks = await client.getBlocks({ page: 1, pageSize: 10 });
console.log(`Found ${recentBlocks.total} blocks.`);
```

## Get Transaction by Hash

Retrieves a transaction by its unique hash.

`GET /api/transactions/{hash}`

### Parameters

| Name | In | Type | Description |
| :--- | :--- | :--- | :--- |
| `hash` | path | string | The hash of the transaction to retrieve. |

### Response

A [Transaction object](../sdk/types.md#transaction).

### SDK Usage

```typescript
const tx = await client.getTransaction("0xabc...");
console.log(`Transaction from: ${tx.from}`);
```
