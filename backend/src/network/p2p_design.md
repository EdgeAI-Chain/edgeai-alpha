# EdgeAI P2P Network Layer Design

## 1. Overview

The P2P network layer enables EdgeAI nodes to:
- Discover and connect to other nodes
- Broadcast transactions and blocks via Gossip
- Synchronize blockchain state
- Handle peer management

## 2. Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Application Layer                     │
│  (Blockchain, Mempool, Consensus)                       │
├─────────────────────────────────────────────────────────┤
│                    Network Service                       │
│  - Message routing                                       │
│  - Event handling                                        │
├─────────────────────────────────────────────────────────┤
│                    libp2p Protocols                      │
│  - GossipSub (pub/sub messaging)                        │
│  - Kademlia (peer discovery)                            │
│  - Identify (peer identification)                       │
├─────────────────────────────────────────────────────────┤
│                    Transport Layer                       │
│  - TCP/QUIC                                             │
│  - Noise (encryption)                                   │
│  - Yamux (multiplexing)                                 │
└─────────────────────────────────────────────────────────┘
```

## 3. Message Types

### 3.1 Gossip Topics

| Topic | Description |
| :--- | :--- |
| `edgeai/tx/1.0.0` | New transactions |
| `edgeai/block/1.0.0` | New blocks |
| `edgeai/contribution/1.0.0` | Contribution proofs |

### 3.2 Message Format

```rust
enum NetworkMessage {
    // Transaction broadcast
    NewTransaction(Transaction),
    
    // Block broadcast
    NewBlock(Block),
    
    // Contribution proof broadcast
    NewContribution(ContributionProof),
    
    // Sync requests
    GetBlocks { start_height: u64, count: u64 },
    Blocks(Vec<Block>),
    
    // Peer info
    GetPeers,
    Peers(Vec<PeerInfo>),
}
```

## 4. Node Identity

Each node has a unique identity based on:
- Ed25519 keypair (generated or loaded from disk)
- PeerId derived from public key
- Multiaddress for network location

## 5. Peer Discovery

### 5.1 Bootstrap Nodes
- Hardcoded list of known bootstrap nodes
- Used for initial network entry

### 5.2 Kademlia DHT
- Distributed hash table for peer discovery
- Nodes announce themselves and discover others

### 5.3 mDNS (Local Discovery)
- For local network testing
- Automatically discovers peers on same LAN

## 6. Gossip Protocol (GossipSub)

- Mesh-based pub/sub protocol
- Efficient message propagation
- Built-in spam protection
- Configurable parameters:
  - mesh_n: target mesh size (6)
  - mesh_n_low: minimum mesh size (4)
  - mesh_n_high: maximum mesh size (12)
  - gossip_lazy: lazy gossip peers (6)

## 7. Connection Management

- Max inbound connections: 50
- Max outbound connections: 50
- Connection timeout: 30s
- Idle connection timeout: 5min
