# Vercel 重新部署指南

## 问题描述

Vercel 自动部署在提交 `2835ad2` 之后停止触发。最新的 4 个提交没有被部署：

| 提交 | 描述 | 状态 |
|------|------|------|
| `1cb190f` | docs: Update README | ❌ 未部署 |
| `0a9fb1b` | fix: Replace remaining Hashrate with Network Entropy | ❌ 未部署 |
| `0e2f892` | chore: trigger Vercel deployment | ❌ 未部署 |
| `479da7a` | feat: Replace Hashrate with PoIE network metrics | ❌ 未部署 |
| `2835ad2` | refactor(backend): Reorganize mempool transaction collection | ✅ 当前生产版本 |

## 手动重新部署步骤

### 方法 1: 通过 Vercel Dashboard

1. 登录 [Vercel Dashboard](https://vercel.com/dashboard)
2. 选择 `edgeai-alpha` 项目
3. 点击 "Deployments" 标签
4. 找到最新的部署记录
5. 点击右侧的 "..." 菜单
6. 选择 "Redeploy" 或 "Redeploy with existing Build Cache"

### 方法 2: 检查 Git Integration

1. 在 Vercel Dashboard 中进入项目设置
2. 点击 "Git" 标签
3. 确认 "Connected Git Repository" 显示 `Free0x/edgeai-alpha`
4. 确认 "Production Branch" 设置为 `main`
5. 确认 "Root Directory" 设置为 `frontend`

### 方法 3: 断开并重新连接 Git

如果上述方法无效：
1. 在项目设置中断开 Git 连接
2. 重新连接到 `Free0x/edgeai-alpha` 仓库
3. 设置 Root Directory 为 `frontend`
4. 触发新的部署

## 验证部署成功

部署完成后，访问 https://edgeai-alpha.vercel.app 并检查：

1. Dashboard 页面应显示以下新指标卡片：
   - **Network Entropy** (而不是 Network Hashrate)
   - **TPS** (每秒交易数)
   - **Data Throughput** (数据吞吐量 KB/s)
   - **Validator Power** (验证者算力指数)

2. Validators 页面应显示：
   - **Total Network Entropy** (而不是 Total Network Hashrate)

## 技术说明

这些更改是为了让指标更符合 PoIE (Proof of Information Entropy) 共识机制：

- **Network Entropy**: 衡量区块链中数据的信息熵总量
- **TPS**: 实时交易处理速度
- **Data Throughput**: 网络数据流量
- **Validator Power**: 验证者的综合算力指数

## 后端 API 确认

后端 API 已正确返回这些指标：

```bash
curl https://edgeai-blockchain-node.fly.dev/api/chain
```

返回示例：
```json
{
  "network_entropy": 26173.07,
  "data_throughput": 27.02,
  "tps": 0.11,
  "validator_power": 336.41
}
```
