---
sidebar_position: 4
---

# Governance API

The Governance API provides endpoints for interacting with the on-chain DAO (Decentralized Autonomous Organization), allowing users to create and vote on proposals.

## Get Governance Statistics

Retrieves statistics about the governance module.

`GET /api/governance/stats`

### Response

```json
{
  "totalProposals": 25,
  "activeProposals": 3,
  "passedProposals": 15,
  "rejectedProposals": 5,
  "totalVotes": 12345,
  "config": {
    "minDeposit": "10000000000000000000000",
    "votingPeriodDays": 7,
    "quorumPercentage": 33.3,
    "passThreshold": 50,
    "vetoThreshold": 33.3,
    "executionDelayDays": 2
  }
}
```

### SDK Usage

```typescript
const stats = await client.getGovernanceStats();
console.log(`There are ${stats.activeProposals} active proposals.`);
```

## Get Proposals

Retrieves a paginated list of governance proposals.

`GET /api/governance/proposals`

### Query Parameters

| Name | Type | Description |
| :--- | :--- | :--- |
| `page` | integer | The page number to retrieve (default: 1). |
| `pageSize` | integer | The number of proposals per page (default: 20). |
| `status` | string | Filter by proposal status (`Deposit`, `Voting`, `Passed`, `Rejected`, `Executed`). |
| `proposer` | string | Filter by the address of the proposer. |

### Response

A [PaginatedResponse](../sdk/types.md#paginatedresponse) of [Proposal](../sdk/types.md#proposal) objects.

### SDK Usage

```typescript
const votingProposals = await client.getProposals({ status: 'Voting' });
console.log(`Found ${votingProposals.total} proposals in the voting period.`);
```

## Get Proposal

Retrieves detailed information for a single proposal.

`GET /api/governance/proposals/{id}`

### Parameters

| Name | In | Type | Description |
| :--- | :--- | :--- | :--- |
| `id` | path | integer | The ID of the proposal to retrieve. |

### Response

A [Proposal object](../sdk/types.md#proposal).

### SDK Usage

```typescript
const proposal = await client.getProposal(15);
console.log(`Proposal Title: ${proposal.title}`);
```

## Submit Proposal

Submits a new governance proposal.

`POST /api/governance/proposals`

### Request Body

A signed transaction with [SubmitProposalParams](../sdk/types.md#submitproposalparams).

### SDK Usage

```typescript
// Simplified example
const txHash = await wallet.submitProposal({
  title: 'Increase Block Size',
  description: 'This proposal aims to increase the maximum block size...',
  proposalType: 'ParameterChange',
  initialDeposit: '10000' // 10,000 EDGE
});
```

## Deposit on Proposal

Adds to the deposit of a proposal to help it meet the minimum threshold for entering the voting period.

`POST /api/governance/proposals/{id}/deposit`

### Request Body

A signed transaction with an amount.

### SDK Usage

```typescript
// Simplified example
const txHash = await wallet.depositOnProposal(15, '500'); // Deposit 500 EDGE
```

## Vote on Proposal

Casts a vote on a proposal that is in the voting period.

`POST /api/governance/proposals/{id}/vote`

### Request Body

A signed transaction with a `vote` option.

| Field | Type | Description |
| :--- | :--- | :--- |
| `vote` | string | The vote option: `Yes`, `No`, `Abstain`, `NoWithVeto`. |

### SDK Usage

```typescript
// Simplified example
const txHash = await wallet.voteOnProposal(15, 'Yes');
```
