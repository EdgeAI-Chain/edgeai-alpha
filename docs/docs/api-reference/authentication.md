---
sidebar_position: 1
---

# Authentication

Most endpoints on the EdgeAI network are public and do not require authentication. However, for actions that require a user to prove their identity (e.g., sending transactions, voting), requests must be signed.

For certain administrative or privileged endpoints, API key-based authentication is used.

## API Key

If you have been provided with an API key for a specific service or a private node, you should include it in the `X-API-Key` header of your requests.

```http
X-API-Key: YOUR_API_KEY
```

### SDK Usage

When using the TypeScript SDK, you can configure the client to automatically include the API key in all requests.

```typescript
import { EdgeAIClient } from '@edgeai/sdk';

const client = new EdgeAIClient({
  baseUrl: 'https://your-private-node.com',
  apiKey: 'YOUR_API_KEY',
});
```

## Signed Transactions

Operations that modify the blockchain state, such as transfers, staking, or contract calls, must be submitted as signed transactions. This process involves creating a transaction object, signing it with the sender's private key, and then broadcasting it to the network.

The SDK handles the complexities of transaction creation and signing. You will typically need to provide a wallet or a signer instance that can securely manage your private keys.

### Example: Signing a Transfer

```typescript
import { EdgeAIClient, Wallet } from '@edgeai/sdk';

// This is a simplified example. In a real app, manage keys securely.
const privateKey = '...'; 
const wallet = new Wallet(privateKey);
const client = new EdgeAIClient({ baseUrl: '...' });

async function sendTokens() {
  const tx = await client.createTransfer({
    to: '0xRecipientAddress...',
    amount: '100', // 100 EDGE
  });

  const signedTx = await wallet.signTransaction(tx);

  const txHash = await client.broadcastTransaction(signedTx);
  console.log(`Transaction broadcasted with hash: ${txHash}`);
}
```

By signing transactions, you authorize the network to perform actions on your behalf without exposing your private keys to the API server or any intermediaries. The node simply verifies the signature to confirm the transaction's authenticity.
