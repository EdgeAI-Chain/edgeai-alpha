# EdgeAI Alpha

**The Most Intelligent Data Chain for Edge AI**

EdgeAI Alpha is a complete blockchain ecosystem designed specifically for edge AI applications. This repository uses a Monorepo structure, containing two core components: the blockchain node (backend) and the blockchain explorer (frontend).

## Project Structure

```
edgeai-alpha/
├── backend/          # Blockchain Node (Rust + Actix Web)
│   ├── src/          # Source code
│   ├── Cargo.toml    # Rust dependencies
│   └── README.md     # Backend documentation
├── frontend/         # Blockchain Explorer (React + TypeScript + Vite)
│   ├── client/       # Frontend application source
│   ├── server/       # Production server
│   └── README.md     # Frontend documentation
├── sdk/              # TypeScript SDK
│   └── typescript/   # @edgeai/sdk package
├── docs/             # Documentation site (Docusaurus)
└── README.md         # This file
```

## Core Features

### Backend - Blockchain Node

- **PoIE Consensus**: Innovative Proof of Information Entropy consensus algorithm
- **Data Marketplace**: Support for data listing, purchasing, and quality assessment
- **Smart Contracts**: Data marketplace, federated learning, and device registration contracts
- **RESTful API**: Complete HTTP API interface
- **Persistent Storage**: Automatic blockchain state persistence
- **P2P Networking**: libp2p-based peer-to-peer communication

### Frontend - Blockchain Explorer

- **Real-time Dashboard**: Live monitoring of block height, difficulty, TPS, and more
- **3D Network Visualization**: Interactive 3D globe showing validator distribution
- **Staking Interface**: Delegate tokens and manage staking positions
- **Governance Portal**: Create proposals and participate in on-chain voting
- **IoT Data Integration**: Dedicated IoT transaction visualization
- **Wallet Guide**: Interactive wallet creation and transaction tutorials
- **Responsive Design**: Optimized for both desktop and mobile devices

### SDK - TypeScript Client

- **Full API Coverage**: Complete client for all blockchain endpoints
- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **Easy Integration**: Simple installation via npm/pnpm

## Quick Start

### Run a Node with Docker

```bash
docker run -d \
  --name edgeai-node \
  -p 8080:8080 \
  -p 9000:9000 \
  -v edgeai_data:/data \
  --restart always \
  ghcr.io/edgeai-chain/edgeai-alpha/edgeai-node:latest
```

### Build from Source

#### Backend

```bash
cd backend
cargo build --release
./target/release/edgeai-node
```

After starting the node:
- API Endpoint: http://localhost:8080/api/
- Built-in Explorer: http://localhost:8080/

#### Frontend

```bash
cd frontend
pnpm install
pnpm dev
```

Development server: http://localhost:3000

### SDK Installation

```bash
npm install @edgeai/sdk
# or
pnpm add @edgeai/sdk
```

```typescript
import { EdgeAIClient } from '@edgeai/sdk';

const client = new EdgeAIClient({
  baseUrl: 'https://edgeai-blockchain-node.fly.dev'
});

const chainInfo = await client.getChainInfo();
console.log(`Block Height: ${chainInfo.height}`);
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| **Backend Language** | Rust |
| **Backend Framework** | Actix Web |
| **Frontend Framework** | React 19 + TypeScript |
| **Build Tool** | Vite |
| **UI Components** | Tailwind CSS + shadcn/ui |
| **Data Visualization** | Recharts, Cobe (3D Globe) |
| **Documentation** | Docusaurus |

## Live Demo

- **Explorer**: [https://edgeai-alpha.vercel.app](https://edgeai-alpha.vercel.app)
- **API**: [https://edgeai-blockchain-node.fly.dev/api/chain](https://edgeai-blockchain-node.fly.dev/api/chain)

## License

MIT License

## Contributing

Issues and Pull Requests are welcome!
