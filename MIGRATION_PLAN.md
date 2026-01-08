# 前端模拟数据迁移计划

## 概述

本文档详细说明将前端模拟数据生成逻辑迁移到后端的实施计划。

## 迁移范围

### 需要迁移到后端的模块

| 模块 | 文件 | 说明 | 优先级 |
|------|------|------|--------|
| **IoT 交易生成器** | `lib/iotGenerator.ts` | 生成模拟 IoT 设备数据、传感器读数等 | 高 |
| **验证者数据** | `lib/validators.ts` | 生成 30000 个验证者节点的数据 | 高 |
| **Dashboard 区块模拟** | `pages/Dashboard.tsx` | `setInterval` 本地模拟新区块 | 中 |

### 保留在前端的模块（地球动画效果）

| 模块 | 文件 | 说明 |
|------|------|------|
| **地球标记数据** | `lib/globeData.ts` | 静态的地球可视化标记点 |
| **交易动画模拟器** | `hooks/useTransactionSimulator.ts` | 地球上的脉冲动画效果 |

## 后端新增 API 设计

### 1. IoT 交易 API

**端点**: `GET /api/iot/transactions`

**查询参数**:
- `page`: 页码 (默认 1)
- `limit`: 每页数量 (默认 20)
- `sector`: 过滤行业 (可选)

**响应**:
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "0x1234...",
        "hash": "0x1234...",
        "tx_type": "DataContribution",
        "from": "0xsender...",
        "to": "0xreceiver...",
        "amount": 1.2345,
        "timestamp": "2026-01-08T12:00:00Z",
        "status": "Confirmed",
        "sector": "Smart City",
        "device_type": "Traffic Cam",
        "location": "New York, USA",
        "coordinates": [40.7128, -74.0060],
        "data_payload": "{\"traffic_density\": \"high\", \"avg_speed\": 45}"
      }
    ],
    "total": 100000,
    "page": 1,
    "limit": 20
  }
}
```

### 2. 验证者 API

**端点**: `GET /api/validators`

**查询参数**:
- `page`: 页码 (默认 1)
- `limit`: 每页数量 (默认 100)
- `status`: 过滤状态 (online/offline/maintenance)

**响应**:
```json
{
  "success": true,
  "data": {
    "validators": [
      {
        "id": "val_00001",
        "name": "edge_node_00001",
        "status": "online",
        "blocks_mined": 4523,
        "reputation": 98.5,
        "uptime": 99.2,
        "location": "US-East (N. Virginia)",
        "lat": 39.0438,
        "lng": -77.4874
      }
    ],
    "total": 30000,
    "stats": {
      "online": 29100,
      "offline": 600,
      "maintenance": 300
    }
  }
}
```

### 3. 验证者地图 API（用于地球可视化）

**端点**: `GET /api/validators/map`

**响应**:
```json
{
  "success": true,
  "data": {
    "markers": [
      {
        "location": [40.7128, -74.0060],
        "size": 0.08,
        "tooltip": "New York Hub",
        "type": "hub",
        "validator_count": 1250
      }
    ],
    "total_validators": 30000
  }
}
```

### 4. 网络统计 API（增强版）

**端点**: `GET /api/network/stats`

**响应**:
```json
{
  "success": true,
  "data": {
    "height": 12045,
    "difficulty": 2.14,
    "avg_block_time": 10.2,
    "tps": 15.4,
    "total_transactions": 589201,
    "total_validators": 30000,
    "active_validators": 29100,
    "sectors": {
      "smart_city": 15234,
      "industrial": 12456,
      "agriculture": 8765,
      "healthcare": 6543,
      "logistics": 5432,
      "energy": 4321
    }
  }
}
```

## 实施步骤

### Phase 1: 后端开发

1. 创建 `src/iot/` 模块
   - 定义 IoT 行业和设备类型
   - 实现确定性数据生成算法
   - 添加 API 端点

2. 扩展 `src/network/` 模块
   - 添加验证者地理位置数据
   - 实现验证者列表 API
   - 实现验证者地图聚合 API

3. 增强 `src/api/rest.rs`
   - 添加新的 API 路由
   - 实现分页和过滤逻辑

### Phase 2: 前端更新

1. 更新 `lib/api.ts`
   - 添加新 API 调用函数
   - 保留回退到模拟数据的逻辑

2. 更新 `pages/Transactions.tsx`
   - 从后端获取 IoT 交易数据

3. 更新 `pages/Validators.tsx`
   - 从后端获取验证者列表

4. 更新 `pages/Dashboard.tsx`
   - 移除本地区块模拟
   - 使用后端数据驱动图表

5. 保留 `hooks/useTransactionSimulator.ts`
   - 仅用于地球动画效果
   - 不影响实际数据展示

## 数据一致性策略

- 后端使用确定性随机数生成器（LCG），确保相同参数产生相同数据
- 前端保留回退逻辑，当后端不可用时使用本地模拟
- 地球动画效果独立于实际数据，仅用于视觉增强
