# EdgeAI Blockchain Deployment Guide

This guide covers multiple deployment options for the EdgeAI blockchain node and explorer.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Option 1: Fly.io (Recommended)](#option-1-flyio-recommended)
3. [Option 2: Railway.app](#option-2-railwayapp)
4. [Option 3: Render.com](#option-3-rendercom)
5. [Option 4: Docker (Self-hosted)](#option-4-docker-self-hosted)
6. [Option 5: Manual VPS Deployment](#option-5-manual-vps-deployment)
7. [Post-Deployment](#post-deployment)

---

## Prerequisites

- Git installed
- Docker installed (for local testing)
- Account on your chosen cloud platform

---

## Option 1: Fly.io (Recommended)

Fly.io offers a generous free tier and global edge deployment.

### Step 1: Install Fly CLI

```bash
# macOS
brew install flyctl

# Linux
curl -L https://fly.io/install.sh | sh

# Windows
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

### Step 2: Login to Fly.io

```bash
fly auth login
```

### Step 3: Deploy

```bash
cd edgeai-blockchain

# First time deployment
fly launch --name edgeai-blockchain --region sin

# Subsequent deployments
fly deploy
```

### Step 4: Access Your App

```bash
fly open
```

Your app will be available at: `https://edgeai-blockchain.fly.dev`

### Useful Commands

```bash
# View logs
fly logs

# Check status
fly status

# Scale up
fly scale count 2

# SSH into container
fly ssh console
```

---

## Option 2: Railway.app

Railway offers simple deployment with $5/month free credits.

### Step 1: Install Railway CLI

```bash
npm install -g @railway/cli
```

### Step 2: Login

```bash
railway login
```

### Step 3: Deploy

```bash
cd edgeai-blockchain
railway init
railway up
```

### Step 4: Get Public URL

```bash
railway domain
```

---

## Option 3: Render.com

Render offers free web services with automatic HTTPS.

### Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/edgeai-blockchain.git
git push -u origin main
```

### Step 2: Deploy on Render

1. Go to [render.com](https://render.com)
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Render will auto-detect the `render.yaml` configuration
5. Click "Create Web Service"

---

## Option 4: Docker (Self-hosted)

For deployment on your own server or VPS.

### Using Docker Compose

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### Using Docker directly

```bash
# Build image
docker build -t edgeai-blockchain .

# Run container
docker run -d \
  --name edgeai-blockchain \
  -p 8080:8080 \
  --restart unless-stopped \
  edgeai-blockchain
```

---

## Option 5: Manual VPS Deployment

For deployment on a bare VPS (Ubuntu 22.04).

### Step 1: Install Dependencies

```bash
sudo apt update
sudo apt install -y build-essential pkg-config libssl-dev curl

# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

### Step 2: Build

```bash
cd edgeai-blockchain
cargo build --release
```

### Step 3: Create Systemd Service

```bash
sudo tee /etc/systemd/system/edgeai.service > /dev/null <<EOF
[Unit]
Description=EdgeAI Blockchain Node
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/edgeai-blockchain
ExecStart=/home/ubuntu/edgeai-blockchain/target/release/edgeai-blockchain
Restart=always
RestartSec=10
Environment=RUST_LOG=info

[Install]
WantedBy=multi-user.target
EOF
```

### Step 4: Start Service

```bash
sudo systemctl daemon-reload
sudo systemctl enable edgeai
sudo systemctl start edgeai
```

### Step 5: Setup Nginx (Optional)

```bash
sudo apt install -y nginx

sudo tee /etc/nginx/sites-available/edgeai > /dev/null <<EOF
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/edgeai /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## Post-Deployment

### Verify Deployment

```bash
# Check API
curl https://your-domain.com/api/chain

# Expected response
{
  "success": true,
  "data": {
    "block_height": 4,
    "total_transactions": 19,
    ...
  }
}
```

### Monitor Health

All deployment options include health checks at `/api/chain`.

### Access Explorer

Open your browser and navigate to your deployment URL to access the blockchain explorer.

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | HTTP server port | `8080` |
| `RUST_LOG` | Log level | `info` |

---

## Troubleshooting

### Container won't start

Check logs:
```bash
# Fly.io
fly logs

# Docker
docker logs edgeai-blockchain

# Systemd
journalctl -u edgeai -f
```

### Health check failing

Ensure the `/api/chain` endpoint is responding:
```bash
curl http://localhost:8080/api/chain
```

### Out of memory

Increase memory allocation in your deployment configuration.

---

## Support

For issues, please open a GitHub issue or contact support@edgeai.xyz
