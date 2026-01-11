---
sidebar_position: 2
---

# Guide: Participating in Governance

On-chain governance is a cornerstone of the EdgeAI network, empowering the community to collectively make decisions about the future of the protocol. Any holder of EDGE tokens can participate by creating proposals, depositing on proposals, and voting.

This guide explains how to get involved in the governance process.

## The Governance Lifecycle

A proposal goes through several stages:

1.  **Submission:** A user submits a new proposal along with an initial deposit.
2.  **Deposit Period:** The proposal is in a "deposit" state until it reaches a minimum deposit threshold. Other users can contribute to the deposit. If the threshold isn't met within a certain time, the proposal fails and deposits are burned.
3.  **Voting Period:** Once the deposit threshold is met, the proposal enters the voting period. Token holders can now cast their votes.
4.  **Tallying:** When the voting period ends, the votes are tallied. The proposal passes if it meets the quorum (minimum participation) and the pass threshold (percentage of "Yes" votes).
5.  **Execution:** If a proposal passes, there is a waiting period before it is automatically executed by the protocol.

## How to Vote

If you have staked EDGE tokens (either as a validator or a delegator), you have voting power. Your vote's weight is proportional to your staked amount.

### Step 1: Find Active Proposals

First, find proposals that are currently in the voting period.

```typescript
import { EdgeAIClient } from '@edgeai/sdk';

const client = new EdgeAIClient({ baseUrl: '...' });

async function findActiveProposals() {
  const proposals = await client.getProposals({ status: 'Voting' });
  console.log('Proposals open for voting:', proposals.items);
}
```

### Step 2: Cast Your Vote

Once you've decided how to vote on a proposal, you can submit your vote. This requires a signed transaction.

There are four voting options:

-   `Yes`: You are in favor of the proposal.
-   `No`: You are against the proposal.
-   `Abstain`: You are formally abstaining from voting. This contributes to the quorum but does not count towards the Yes/No tally.
-   `NoWithVeto`: A strong "No" vote. If the percentage of `NoWithVeto` votes exceeds a certain threshold, the proposal is rejected, and the depositors may lose their deposits.

```typescript
// Simplified example
async function vote(proposalId: number, option: 'Yes' | 'No' | 'Abstain' | 'NoWithVeto') {
  const txHash = await wallet.voteOnProposal(proposalId, option);
  console.log(`Vote transaction sent: ${txHash}`);
}
```

## How to Create a Proposal

If you have an idea for improving the EdgeAI network, you can create a formal proposal.

### Step 1: Draft Your Proposal

A good proposal should have a clear title, a detailed description of the proposed change, and a rationale for why it's needed.

### Step 2: Submit the Proposal

Submitting a proposal requires an initial deposit. This deposit is at risk and may be burned if the proposal is vetoed or fails to meet the deposit threshold.

```typescript
// Simplified example
async function createProposal() {
  const txHash = await wallet.submitProposal({
    title: 'Increase Validator Set Size',
    description: 'To further decentralize the network, this proposal seeks to increase the active validator set from 100 to 125.',
    proposalType: 'ParameterChange',
    initialDeposit: '10000', // 10,000 EDGE
  });

  console.log(`Proposal submission transaction sent: ${txHash}`);
}
```

After submission, your proposal will enter the deposit period. You can share the proposal ID with the community to encourage others to contribute to the deposit and help it enter the voting phase.
