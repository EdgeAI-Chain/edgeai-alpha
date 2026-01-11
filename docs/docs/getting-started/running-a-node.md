---
sidebar_position: 2
---

# Running an EdgeAI Node

Running an EdgeAI node is a critical step towards participating in the network, whether you want to be a validator, a developer, or simply a user who wants to interact directly with the blockchain. This guide provides instructions for setting up and running a full node.

## Prerequisites

Before you begin, ensure you have the following prerequisites installed on your system:

- **Rust:** The EdgeAI node is built with Rust. You can install it using `rustup`:
  ```bash
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
  ```
- **Git:** To clone the source code repository.
- **Build Essentials:** A C compiler, linker, and other essential build tools.
  ```bash
  # On Debian/Ubuntu
  sudo apt-get update && sudo apt-get install build-essential
  ```
- **Docker (Optional):** For running the node in a containerized environment.

## Building from Source

This is the recommended method for running a full node, as it gives you the most control over the configuration.

### 1. Clone the Repository

First, clone the official EdgeAI blockchain repository from GitHub:

```bash
git clone https://github.com/Free0x/edgeai-alpha.git
cd edgeai-alpha/backend
```

### 2. Configure Your Node

The node's configuration is managed through a `config.toml` file. A default configuration is provided, but you can customize it to suit your needs. Key parameters include:

- **P2P Settings:** Port, seed nodes, max peers.
- **API Settings:** API server address and port.
- **Logging:** Log level and output file.

Create a `config.toml` from the example:

```bash
cp config.example.toml config.toml
```

### 3. Build the Node

Compile the node using Cargo, the Rust build tool. For a production-ready build, use the `--release` flag.

```bash
cargo build --release
```

The compiled binary will be located at `target/release/edgeai-node`.

### 4. Run the Node

Once the build is complete, you can start your node:

```bash
./target/release/edgeai-node --config config.toml
```

Your node will begin connecting to peers and synchronizing with the network. You can monitor its progress by observing the log output.

## Using Docker (Recommended for Production)

For a more isolated and reproducible setup, we provide a Docker image.

### 1. Pull the Docker Image

Pull the latest official image from Docker Hub (or our GitHub container registry).

```bash
# Replace with the correct image path once published
docker pull edgeai/edgeai-node:latest
```

### 2. Run the Container

Run the node inside a Docker container, mounting a local directory for data persistence.

```bash
mkdir -p /path/to/your/data
docker run -d --name edgeai-node \
  -p 30333:30333/tcp -p 30333:30333/udp \
  -p 9944:9944 \
  -v /path/to/your/data:/data \
  edgeai/edgeai-node:latest \
  --base-path /data \
  --chain mainnet \
  --port 30333 \
  --ws-port 9944 \
  --ws-external
```

This command starts the node, exposes the necessary P2P and API ports, and ensures that the blockchain data is stored on your host machine.

## Public Endpoints

For development and testing purposes, the EdgeAI Foundation maintains a public API endpoint. You can use this to interact with the network without running your own node.

- **API URL:** `https://edgeai-blockchain-node.fly.dev`

This endpoint is rate-limited and should not be used for high-volume production applications. For serious development or to become a validator, you must run your own full node.
