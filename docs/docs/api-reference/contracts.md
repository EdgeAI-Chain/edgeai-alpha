---
sidebar_position: 5
---

# Smart Contracts API

The Smart Contracts API provides endpoints for deploying and interacting with WebAssembly (WASM) smart contracts on the EdgeAI blockchain.

## Get Contract

Retrieves information about a deployed smart contract.

`GET /api/contracts/{address}`

### Parameters

| Name      | In   | Type   | Description                           |
| :-------- | :--- | :----- | :------------------------------------ |
| `address` | path | string | The address of the smart contract.    |

### Response

A [Contract object](../sdk/types.md#contract).

### SDK Usage

```typescript
const contract = await client.getContract("0xContractAddress...");
console.log(`Contract was created by: ${contract.creator}`);
```

## Get Contracts (Paginated)

Retrieves a paginated list of all deployed smart contracts.

`GET /api/contracts`

### Query Parameters

| Name       | Type    | Description                                      |
| :--------- | :------ | :----------------------------------------------- |
| `page`     | integer | The page number to retrieve (default: 1).        |
| `pageSize` | integer | The number of contracts per page (default: 20).  |

### Response

A [PaginatedResponse](../sdk/types.md#paginatedresponse) of [Contract](../sdk/types.md#contract) objects.

### SDK Usage

```typescript
const contracts = await client.getContracts({ page: 1, pageSize: 10 });
console.log(`There are ${contracts.total} contracts on the network.`);
```

## Read Contract Storage (State)

Reads a value from a contract's public storage. This is a read-only operation and does not consume gas.

`GET /api/contracts/{address}/storage/{key}`

### Parameters

| Name      | In   | Type   | Description                               |
| :-------- | :--- | :----- | :---------------------------------------- |
| `address` | path | string | The address of the smart contract.        |
| `key`     | path | string | The storage key to read.                  |

### Response

The value stored at the specified key.

```json
{
  "key": "balanceOf_0x123...",
  "value": "100000000000000000000"
}
```

### SDK Usage

```typescript
const balance = await client.readContractStorage("0xTokenContract...", "balanceOf_0xMyAddress...");
console.log(`My token balance: ${balance.value}`);
```

## Deploy Contract

Submits a transaction to deploy a new WASM smart contract.

`POST /api/contracts/deploy`

### Request Body

A signed transaction with [DeployContractParams](../sdk/types.md#deploycontractparams).

### SDK Usage

```typescript
// Simplified example
const wasmCode = "0x..."; // Hex-encoded WASM bytecode
const txHash = await wallet.deployContract({
  code: wasmCode,
  args: ["MyToken", "TKN", 1000000] // Constructor arguments
});
```

## Call Contract Function

Submits a transaction to call a function on a deployed smart contract.

`POST /api/contracts/call`

### Request Body

A signed transaction with [CallContractParams](../sdk/types.md#callcontractparams).

### SDK Usage

```typescript
// Simplified example for a state-changing call
const txHash = await wallet.callContract({
  contract: "0xTokenContract...",
  function: "transfer",
  args: ["0xRecipientAddress...", "100"]
});

// For a read-only call, you can use a different method
const result = await client.queryContract({
  contract: "0xTokenContract...",
  function: "balanceOf",
  args: ["0xMyAddress..."]
});
console.log(`Balance: ${result}`);
```
