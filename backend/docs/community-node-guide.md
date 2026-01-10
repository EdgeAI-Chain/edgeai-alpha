# EdgeAI 社区节点部署指南

欢迎加入 EdgeAI 网络！通过运行一个社区节点，您可以为网络的安全和去中心化做出贡献，并获得 EDGE 代币奖励。

本指南将帮助您通过一行命令快速启动一个 EdgeAI 节点。

## 1. 系统要求

- **操作系统**: Linux, macOS, or Windows (with Docker Desktop)
- **CPU**: 1 核或以上
- **内存**: 512MB 或以上
- **存储**: 10GB 或以上
- **网络**: 稳定的互联网连接，并开放 TCP 端口 9000

## 2. 安装 Docker

如果您的系统尚未安装 Docker，请根据您的操作系统从 [Docker 官网](https://docs.docker.com/get-docker/) 下载并安装。

## 3. 一键启动节点

打开您的终端或命令行工具，运行以下命令：

```bash
docker run -d --name edgeai-node \
  -p 9000:9000 \
  -p 8080:8080 \
  -v edgeai_data:/data \
  ghcr.io/free0x/edgeai-alpha/edgeai-node:latest
```

**命令解释:**
- `docker run -d`: 在后台运行容器
- `--name edgeai-node`: 为容器命名为 `edgeai-node`
- `-p 9000:9000`: 将主机的 9000 端口映射到容器的 9000 端口 (P2P 网络)
- `-p 8080:8080`: 将主机的 8080 端口映射到容器的 8080 端口 (HTTP API)
- `-v edgeai_data:/data`: 创建一个名为 `edgeai_data` 的 Docker volume，用于持久化存储区块链数据
- `ghcr.io/free0x/edgeai-alpha/edgeai-node:latest`: 使用最新的 EdgeAI 节点镜像

## 4. 验证节点运行

运行以下命令查看节点日志：

```bash
docker logs -f edgeai-node
```

您应该能看到类似以下的日志输出，表示节点正在正常运行并连接到网络：

```
[2026-01-10T10:00:00Z INFO  edgeai_node] ===========================================
[2026-01-10T10:00:00Z INFO  edgeai_node]    EdgeAI Blockchain Node v0.2.0
[2026-01-10T10:00:00Z INFO  edgeai_node]    The Most Intelligent Data Chain
[2026-01-10T10:00:00Z INFO  edgeai_node]    Now with libp2p P2P Networking!
[2026-01-10T10:00:00Z INFO  edgeai_node] ===========================================
[2026-01-10T10:00:01Z INFO  edgeai_node::network::libp2p_network] libp2p P2P network started on port 9000
[2026-01-10T10:00:02Z INFO  edgeai_node::network::libp2p_network] P2P: Peer connected: 12D3KooW...
[2026-01-10T10:00:10Z INFO  edgeai_node] Produced block #1234 with 150 transactions
```

您也可以通过浏览器访问 `http://localhost:8080` 查看节点的区块浏览器。

## 5. 加入社区

如果您遇到任何问题，欢迎加入我们的社区寻求帮助：

- **Discord**: [链接到您的 Discord]
- **Telegram**: [链接到您的 Telegram]
- **GitHub**: [https://github.com/Free0x/edgeai-alpha]

感谢您的贡献！
