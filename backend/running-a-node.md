---
sidebar_position: 2
---

# Running an EdgeAI Node

Running an EdgeAI node allows you to participate in the network as a validator, developer, or user who wants to interact directly with the blockchain. This guide covers multiple setup methods for different operating systems.

## Quick Start: Docker (Recommended)

The fastest way to run an EdgeAI node is using Docker. This works on Linux, macOS, and Windows.

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) installed and running

### Run the Node (Pre-built Image)

```bash
docker run -d --name edgeai-node \
  -p 8080:8080 \
  -p 9000:9000 \
  -v edgeai_data:/data \
  --restart always \
  ghcr.io/edgeai-chain/edgeai-alpha/edgeai-node:latest
```

### Run the Node (Build Locally)

If you want to build the Docker image from source:

```bash
git clone https://github.com/EdgeAI-Chain/edgeai-alpha.git
cd edgeai-alpha/backend

# Build the image
docker build -t edgeai-node .

# Run the container
docker run -d --name edgeai-node \
  -p 8080:8080 \
  -p 9000:9000 \
  -v edgeai_data:/data \
  --restart always \
  edgeai-node
```

**Port explanations:**
- `8080`: HTTP API and built-in explorer
- `9000`: P2P network (libp2p)

### Verify the Node

```bash
# View logs
docker logs -f edgeai-node

# Test the API
curl http://localhost:8080/api/chain
```

You should see log output similar to:

```
[INFO  edgeai_node] ===========================================
[INFO  edgeai_node]    EdgeAI Blockchain Node v0.2.0
[INFO  edgeai_node]    The Most Intelligent Data Chain
[INFO  edgeai_node]    Now with libp2p P2P Networking!
[INFO  edgeai_node] ===========================================
[INFO  edgeai_node::network::libp2p_network] libp2p P2P network started on port 9000
```

Open the built-in explorer at [http://localhost:8080](http://localhost:8080).

### Stop and Clean Up

```bash
docker stop edgeai-node
docker rm edgeai-node
docker volume rm edgeai_data  # Warning: deletes all chain data
```

---

## Building from Source

For more control or development purposes, you can build the node from source.

### Prerequisites

#### Linux (Debian/Ubuntu)

```bash
sudo apt update
sudo apt install -y build-essential pkg-config libssl-dev curl git

# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
```

#### macOS

Install Xcode Command Line Tools:

```bash
xcode-select --install
```

Install dependencies with Homebrew:

```bash
brew install cmake pkg-config openssl@3 llvm
```

If you encounter RocksDB build errors:

```bash
brew install rocksdb
```

Install Rust:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
rustup update stable
```

If `libclang` is not found during build, set:

```bash
export LIBCLANG_PATH="$(brew --prefix llvm)/lib"
```

### Prepare the Data Directory

The node stores data in `/data` by default. This requires appropriate permissions:

```bash
sudo mkdir -p /data
sudo chown -R "$(whoami)":staff /data
```

### Clone and Build

```bash
git clone https://github.com/EdgeAI-Chain/edgeai-alpha.git
cd edgeai-alpha/backend
cargo build --release
```

### Run the Node

```bash
./target/release/edgeai-node
```

Or with environment variables:

```bash
RUST_LOG=info \
EDGEAI_P2P_PORT=9000 \
EDGEAI_BOOTSTRAP_NODES="" \
./target/release/edgeai-node
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `RUST_LOG` | Log level (`debug`, `info`, `warn`, `error`) | `info` |
| `EDGEAI_P2P_PORT` | P2P network port | `9000` |
| `EDGEAI_BOOTSTRAP_NODES` | Comma-separated list of bootstrap node multiaddrs | (empty) |

**Bootstrap node format:** `/ip4/<IP>/tcp/<PORT>/p2p/<PEER_ID>`

Example:
```bash
EDGEAI_BOOTSTRAP_NODES="/ip4/203.0.113.10/tcp/9000/p2p/12D3KooW..."
```

---

## System Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 1 core | 2+ cores |
| Memory | 512 MB | 2 GB |
| Storage | 10 GB | 50 GB SSD |
| Network | 1 Mbps | 10+ Mbps, port 9000 open |

---

## Endpoints

After starting the node:

| Service | URL |
|---------|-----|
| HTTP API | `http://localhost:8080/api/` |
| Built-in Explorer | `http://localhost:8080/` |
| P2P Network | Port `9000` (TCP) |

---

## Public Endpoints

For development and testing, the EdgeAI Foundation maintains a public API endpoint:

- **API URL:** `https://edgeai-blockchain-node.fly.dev`
- **Explorer:** [https://edgeai-alpha.vercel.app](https://edgeai-alpha.vercel.app)

:::caution
Public endpoints are rate-limited and not suitable for production applications. Run your own node for serious development or to become a validator.
:::

---

## Troubleshooting

### Permission Error Creating `/data`

Ensure the directory exists and is owned by your user:

```bash
sudo mkdir -p /data
sudo chown -R "$(whoami)":staff /data
```

### Linker/OpenSSL Errors (macOS)

Install OpenSSL and pkg-config via Homebrew:

```bash
brew install openssl@3 pkg-config
```

### libclang Errors (macOS)

Install LLVM and export the library path:

```bash
brew install llvm
export LIBCLANG_PATH="$(brew --prefix llvm)/lib"
```

### Port Already in Use

Another service is using port 8080 or 9000. Stop the conflicting service or change the node's ports.

### Resetting Local State

To start fresh, remove all chain data:

```bash
# Docker
docker volume rm edgeai_data

# Source build
rm -rf /data/*
```

---

## Next Steps

- **[Using the SDK](./using-the-sdk.md):** Interact with the blockchain programmatically
- **[Staking and Delegation](../guides/staking-and-delegation.md):** Become a validator or delegate tokens
- **[API Reference](../api-reference/chain.md):** Explore the full API documentation
