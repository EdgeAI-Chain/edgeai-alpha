# EdgeAI Node Setup (macOS)

This guide walks through running the EdgeAI blockchain node locally on macOS using the backend code in `backend/`.

## 1) Prerequisites

Install Xcode Command Line Tools (provides `clang`, `make`, SDKs):
```bash
xcode-select --install
```

Install build dependencies with Homebrew:
```bash
brew install cmake pkg-config openssl@3 llvm
```

If you hit RocksDB build errors, also try:
```bash
brew install rocksdb
```

Install Rust (stable toolchain):
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
rustup update stable
```

Optional: if `libclang` is not found during build, set:
```bash
export LIBCLANG_PATH="$(brew --prefix llvm)/lib"
```

## 2) Prepare the data directory

The node is hard-coded to store data in `/data` (see `backend/src/main.rs` and `backend/src/blockchain/chain.rs`). On macOS this requires root privileges:
```bash
sudo mkdir -p /data
sudo chown -R "$(whoami)":staff /data
```

To change the data location, update the `DATA_DIR` constants in `backend/src/main.rs` and `backend/src/blockchain/chain.rs`.

## 3) Build the node

From the repo root:
```bash
cd backend
cargo build --release
```

## 4) Run the node

Run the release binary:
```bash
./target/release/edgeai-node
```

Or run via Cargo with logging and optional P2P configuration:
```bash
RUST_LOG=info \
EDGEAI_P2P_PORT=9000 \
EDGEAI_BOOTSTRAP_NODES="" \
cargo run --release --bin edgeai-node
```

Notes from the code:
- HTTP API + built-in explorer are bound to `0.0.0.0:8080` (currently hard-coded in `backend/src/main.rs`).
- P2P listens on `EDGEAI_P2P_PORT` (default `9000`).
- `EDGEAI_BOOTSTRAP_NODES` accepts a comma-separated list of libp2p multiaddrs, e.g.
  `/ip4/203.0.113.10/tcp/9000/p2p/12D3KooW...`.
- If P2P init fails, the node continues in standalone mode.

## 5) Verify the node

In another terminal:
```bash
curl http://localhost:8080/api/chain
```

Open the built-in explorer:
```bash
open http://localhost:8080/
```

## 6) Common issues

- **Permission error creating `/data`**: ensure the directory exists and is owned by your user (step 2).
- **Linker/openssl errors**: make sure `openssl@3` and `pkg-config` are installed via Homebrew.
- **libclang errors**: install `llvm` and export `LIBCLANG_PATH` (step 1).
- **Ports in use**: stop the conflicting service or change the port in `backend/src/main.rs`.

## 7) Resetting local state

All chain data lives under `/data`. To reset:
```bash
rm -rf /data/*
```

Use this only if you want a fresh chain state.

## 8) Docker-based setup (macOS)

If you prefer Docker Desktop on macOS, you can run the node without installing Rust. This uses the published container image and stores chain data in a Docker volume.

### Install Docker Desktop
- Download and install Docker Desktop for Mac from Docker’s website.
- Ensure Docker is running before continuing.

### Run the node
From the repo root:
```bash
docker run -d --name edgeai-node \
  -p 8080:8080 \
  -p 9000:9000 \
  -v edgeai_data:/data \
  ghcr.io/free0x/edgeai-alpha/edgeai-node:latest
```

### Verify
```bash
docker logs -f edgeai-node
curl http://localhost:8080/api/chain
```

### Stop and clean up
```bash
docker stop edgeai-node
docker rm edgeai-node
docker volume rm edgeai_data
```
