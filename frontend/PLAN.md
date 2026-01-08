# EdgeAI Explorer Backend Integration Plan

## 1. Executive Summary

This document outlines the strategic plan to transition the EdgeAI Explorer from a simulation-based "Demo Mode" to a production-ready "Live Mode" backed by real blockchain data. The goal is to replace frontend-generated mock data with authoritative data fetched from backend APIs while maintaining the rich, interactive visualizations (3D Globe, IoT Heatmaps) that define the user experience.

## 2. Architecture Overview

The transition involves shifting the "Source of Truth" from the client to the server.

*   **Current State (Simulation):**
    *   `Dashboard.tsx` maintains local state for block height and difficulty.
    *   `iotGenerator.ts` creates random transaction payloads.
    *   `globeData.ts` contains hardcoded validator coordinates.
    *   Data consistency is managed via "monotonic guards" on the frontend.

*   **Target State (Production):**
    *   **Backend API** serves as the single source of truth for all blockchain data.
    *   **Frontend** becomes a pure presentation layer, rendering data exactly as received.
    *   **Real-time Updates** are handled via polling (Phase 1) or WebSocket/SSE (Phase 2).
    *   **Fallback Mechanism** preserves the "Demo Mode" for offline demonstrations or development.

## 3. API Schema Specification

To support the existing UI components, the backend must expose the following endpoints.

### 3.1 Network Statistics
**Endpoint:** `GET /api/v1/network/stats`
**Purpose:** Populates the top-level dashboard cards.

```json
{
  "height": 12045,
  "current_difficulty": 2.145,
  "network_hashrate": "45.2 EH/s",
  "active_validators": 124,
  "total_transactions": 589201,
  "avg_block_time": 11.8,
  "tps": 15.4
}
```

### 3.2 Blocks
**Endpoint:** `GET /api/v1/blocks`
**Query Params:** `limit` (default 10), `offset` (default 0)
**Purpose:** Populates the "Latest Blocks" list and "Blocks" page.

```json
[
  {
    "height": 12045,
    "hash": "0xabc...",
    "timestamp": 1704611200,
    "tx_count": 45,
    "validator": {
      "name": "Edge-Node-NY-01",
      "address": "0x123..."
    },
    "size": 102400,
    "difficulty": 2.14
  }
]
```

### 3.3 Transactions (IoT Enhanced)
**Endpoint:** `GET /api/v1/transactions`
**Query Params:** `limit` (default 10), `offset` (default 0)
**Purpose:** Populates "Recent Transactions" and "Transactions" page. Crucial for IoT visualization.

```json
[
  {
    "hash": "0xdef...",
    "block_height": 12045,
    "from": "0xsender...",
    "to": "0xreceiver...",
    "value": "10.5",
    "timestamp": 1704611200,
    "type": "IoT_Data_Upload",
    "metadata": {
      "sector": "Smart City",
      "device_type": "Traffic Sensor",
      "payload_summary": "Traffic density: High",
      "location": { "lat": 40.7128, "lon": -74.0060 }
    }
  }
]
```

### 3.4 Validators (Geo-located)
**Endpoint:** `GET /api/v1/validators/map`
**Purpose:** Populates the 3D Globe and Validators list.

```json
[
  {
    "id": "val_1",
    "name": "US-East-Node",
    "status": "active",
    "location": { "lat": 34.05, "lon": -118.24 },
    "stats": {
      "uptime": "99.9%",
      "blocks_mined": 120
    }
  }
]
```

### 3.5 Historical Charts
**Endpoint:** `GET /api/v1/charts/history`
**Query Params:** `range` (1h, 24h, 7d)
**Purpose:** Populates the "Tx / Block" and "Hashrate" charts.

```json
[
  {
    "timestamp": 1704600000,
    "tx_count": 45,
    "hashrate": 42.5,
    "difficulty": 2.1
  }
]
```

## 4. Implementation Phases

### Phase 1: Type Definitions & Mocking (Current Step)
*   Create `client/src/lib/types/api-schema.ts` to define the strict TypeScript interfaces.
*   Update `client/src/lib/api.ts` to use these new types.

### Phase 2: Simulation Cleanup
*   Refactor `Dashboard.tsx` to remove `setInterval` block generation.
*   Refactor `Blocks.tsx` to remove timestamp backtracking logic.
*   Refactor `Globe3D.tsx` to accept validator data as props instead of internal generation.

### Phase 3: Component Integration
*   Update `Dashboard` to fetch `/stats` and `/blocks`.
*   Update `Validators` to fetch `/validators/map`.
*   Update `Transactions` to handle the `metadata` field for IoT icons.

### Phase 4: Real-time & Fallback
*   Implement a "Demo Mode" toggle in the API layer itself.
*   If the backend is unreachable, seamlessly switch back to the local simulation logic (preserving the current codebase as a fallback module).

## 5. Key Considerations

*   **IoT Data Parsing:** The backend indexer must be capable of decoding transaction input data to extract IoT metadata (Sector, Device Type). If this is not possible on the backend, the frontend will need a utility to decode raw hex data.
*   **Geo-IP Resolution:** Backend should handle IP-to-Location resolution to protect validator privacy (serving only approximate coordinates) and reduce frontend bundle size (no need for local GeoIP DB).
*   **Performance:** For high-throughput chains, the `/transactions` endpoint should be cached or sampled for the dashboard view to prevent UI lag.
