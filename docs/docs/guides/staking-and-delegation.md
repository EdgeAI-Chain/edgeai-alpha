---
sidebar_position: 1
---

# Guide: Staking and Delegation

Staking is the process of locking up your EDGE tokens to participate in the network's consensus mechanism. By staking, you contribute to the security and decentralization of the EdgeAI blockchain and, in return, earn rewards.

This guide covers how to stake your tokens, either as a validator or by delegating to an existing validator.

## Two Ways to Stake

1.  **Become a Validator:** This involves running a full node 24/7, staking a significant amount of EDGE, and actively participating in block production. It offers the highest rewards but also requires technical expertise and a commitment to maintaining your node.

2.  **Delegate to a Validator:** This is the most common way for users to participate in staking. You can delegate your EDGE tokens to a validator of your choice. You'll share in the validator's rewards, minus a small commission, without needing to run your own hardware.

## How to Delegate Your EDGE

Delegating is a simple and effective way to earn staking rewards.

### Step 1: Choose a Validator

First, you need to select a validator to delegate to. You can use the EdgeAI Explorer or the SDK to get a list of active validators.

```typescript
import { EdgeAIClient } from '@edgeai/sdk';

const client = new EdgeAIClient({ baseUrl: '...' });

async function findValidators() {
  const validators = await client.getValidators({ status: 'Active' });
  // Analyze validators based on uptime, commission, and voting power
  console.log(validators.items);
}
```

When choosing a validator, consider:

-   **Uptime:** A higher uptime means the validator is more reliable and less likely to miss blocks (and rewards).
-   **Commission:** This is the percentage of your rewards that the validator keeps. A lower commission means more rewards for you.
-   **Total Stake:** A validator with a large amount of stake (including self-stake and delegations) is often considered more trustworthy.

### Step 2: Delegate Your Tokens

Once you've chosen a validator, you can delegate your tokens using the SDK. This requires a signed transaction from your wallet.

```typescript
// Simplified example using a wallet instance
async function delegate(validatorAddress: string, amount: string) {
  const txHash = await wallet.delegate({
    validator: validatorAddress,
    amount: amount, // Amount in EDGE, e.g., '1000'
  });

  console.log(`Delegation transaction sent: ${txHash}`);
}
```

### Step 3: Manage Your Delegations

You can check your delegations and pending rewards at any time.

```typescript
async function checkMyDelegations(myAddress: string) {
  const delegations = await client.getDelegations(myAddress);
  delegations.forEach(d => {
    console.log(`Delegated ${d.amount} EDGE to ${d.validator}`);
    console.log(`Pending rewards: ${d.rewards} EDGE`);
  });
}
```

## Claiming Rewards

Staking rewards are accrued automatically. You need to send a transaction to claim your pending rewards and add them to your available balance.

```typescript
// Simplified example
async function claim() {
  const txHash = await wallet.claimRewards();
  console.log(`Claim rewards transaction sent: ${txHash}`);
}
```

## Unbonding

If you wish to unstake your tokens, you must initiate an unbonding process. Your tokens will be held in an unbonding state for a period of time (e.g., 7 days) before they become available in your wallet. This waiting period is a security measure for the network.

```typescript
// Simplified example
async function undelegate(validatorAddress: string, amount: string) {
  const txHash = await wallet.undelegate({
    validator: validatorAddress,
    amount: amount,
  });
  console.log(`Undelegation transaction sent: ${txHash}`);
}
```
