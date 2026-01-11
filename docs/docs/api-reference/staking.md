---
sidebar_position: 3
---

# Staking API

The Staking API provides endpoints for interacting with the proof-of-stake system, including querying validators, managing delegations, and claiming rewards.

## Get Staking Statistics

Retrieves network-wide staking statistics.

`GET /api/staking/stats`

### Response

```json
{
  "totalValidators": 150,
  "activeValidators": 100,
  "totalStaked": "125000000000000000000000000",
  "totalDelegated": "89000000000000000000000000",
  "averageCommission": 0.05,
  "currentApy": 12.5
}
```

### SDK Usage

```typescript
const stats = await client.getStakingStats();
console.log(`Current APY: ${stats.currentApy}%`);
```

## Get Validators

Retrieves a paginated list of all validators.

`GET /api/staking/validators`

### Query Parameters

| Name | Type | Description |
| :--- | :--- | :--- |
| `page` | integer | The page number to retrieve (default: 1). |
| `pageSize` | integer | The number of validators per page (default: 50). |
| `status` | string | Filter by validator status (`Active`, `Inactive`, `Jailed`). |

### Response

A [PaginatedResponse](../sdk/types.md#paginatedresponse) of [Validator](../sdk/types.md#validator) objects.

### SDK Usage

```typescript
const activeValidators = await client.getValidators({ status: 'Active' });
console.log(`Found ${activeValidators.total} active validators.`);
```

## Get Validator

Retrieves detailed information for a single validator.

`GET /api/staking/validators/{address}`

### Parameters

| Name | In | Type | Description |
| :--- | :--- | :--- | :--- |
| `address` | path | string | The address of the validator to retrieve. |

### Response

A [Validator object](../sdk/types.md#validator).

### SDK Usage

```typescript
const validator = await client.getValidator("0xValidatorAddress...");
console.log(`Validator ${validator.name} has ${validator.votingPower}% voting power.`);
```

## Get Delegations

Retrieves all delegations for a specific account.

`GET /api/accounts/{address}/delegations`

### Parameters

| Name | In | Type | Description |
| :--- | :--- | :--- | :--- |
| `address` | path | string | The address of the delegator account. |

### Response

An array of [Delegation](../sdk/types.md#delegation) objects.

### SDK Usage

```typescript
const myDelegations = await client.getDelegations("0xMyAddress...");
console.log(`You are delegating to ${myDelegations.length} validators.`);
```

## Stake (Become a Validator)

Submits a transaction to stake tokens and become a validator.

`POST /api/staking/stake`

### Request Body

A signed transaction with [StakeParams](../sdk/types.md#stakeparams).

### SDK Usage

```typescript
// Simplified example
const txHash = await wallet.stake({
  amount: '1000000', // 1,000,000 EDGE
  validatorName: 'My Awesome Node',
  commission: 0.1, // 10%
});
```

## Delegate

Submits a transaction to delegate tokens to a validator.

`POST /api/staking/delegate`

### Request Body

A signed transaction with [DelegateParams](../sdk/types.md#delegateparams).

### SDK Usage

```typescript
// Simplified example
const txHash = await wallet.delegate({
  validator: '0xValidatorAddress...',
  amount: '1000', // 1,000 EDGE
});
```
