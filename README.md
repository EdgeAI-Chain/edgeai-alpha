# EdgeAI Alpha

**The Most Intelligent Data Chain for Edge AI**

EdgeAI Alpha 是一个完整的区块链生态系统，专为边缘 AI 应用场景设计。本仓库采用 Monorepo 结构，包含区块链节点（后端）和区块链浏览器（前端）两个核心组件。

## 项目结构

```
edgeai-alpha/
├── backend/          # 区块链节点 (Rust + Actix Web)
│   ├── src/          # 源代码
│   ├── Cargo.toml    # Rust 依赖配置
│   └── README.md     # 后端详细文档
├── frontend/         # 区块链浏览器 (React + TypeScript + Vite)
│   ├── client/       # 前端应用源码
│   ├── server/       # 生产环境服务器
│   └── README.md     # 前端详细文档
└── README.md         # 本文件
```

## 核心特性

### 后端 - 区块链节点

- **PoIE 共识机制**: 创新的信息熵证明 (Proof of Information Entropy) 共识算法
- **数据市场**: 支持数据上架、购买和质量评估
- **智能合约**: 支持数据市场、联邦学习和设备注册合约
- **RESTful API**: 完整的 HTTP API 接口
- **持久化存储**: 区块链状态自动持久化

### 前端 - 区块链浏览器

- **实时仪表盘**: 区块高度、难度、TPS 等实时监控
- **3D 网络可视化**: 交互式 3D 地球展示验证者分布
- **IoT 数据集成**: 专门的 IoT 交易可视化支持
- **钱包指南**: 交互式钱包创建和交易教程
- **响应式设计**: 完美适配桌面和移动设备

## 快速开始

### 后端

```bash
cd backend
cargo build --release
./target/release/edgeai-node
```

节点启动后:
- API 端点: http://localhost:8080/api/
- 内置浏览器: http://localhost:8080/

### 前端

```bash
cd frontend
pnpm install
pnpm dev
```

开发服务器启动后访问: http://localhost:3000

## 技术栈

| 组件 | 技术 |
|------|------|
| **后端语言** | Rust |
| **后端框架** | Actix Web |
| **前端框架** | React 19 + TypeScript |
| **构建工具** | Vite |
| **UI 组件** | Tailwind CSS + shadcn/ui |
| **数据可视化** | Recharts, Cobe (3D Globe) |

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

