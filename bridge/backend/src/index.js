const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const axios = require('axios');
const winston = require('winston');
require('dotenv').config();

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'bridge.log' })
  ]
});

// Configuration
const config = {
  port: process.env.PORT || 3001,
  edgeaiApiUrl: process.env.EDGEAI_API_URL || 'https://edgeai-blockchain-node.fly.dev',
  evmRpcUrl: process.env.EVM_RPC_URL || 'https://rpc.sepolia.org',
  bridgeContractAddress: process.env.BRIDGE_CONTRACT_ADDRESS,
  wEdgeContractAddress: process.env.WEDGE_CONTRACT_ADDRESS,
  relayerPrivateKey: process.env.RELAYER_PRIVATE_KEY,
  edgeaiBridgeAddress: process.env.EDGEAI_BRIDGE_ADDRESS || 'edgeai_bridge_vault'
};

// Contract ABIs (simplified)
const BRIDGE_ABI = [
  "function processBridgeToEVM(address recipient, uint256 amount, string edgeaiTxHash) external",
  "function getBridgeStats() view returns (uint256, uint256, uint256, uint256)",
  "event BridgeToEdgeAI(address indexed sender, uint256 amount, uint256 fee, string edgeaiAddress, uint256 indexed recordIndex)"
];

const WEDGE_ABI = [
  "function getBridgeStats() view returns (uint256, uint256, uint256, uint256)",
  "function balanceOf(address) view returns (uint256)"
];

// Initialize Express app
const app = express();
app.use(cors());
app.use(express.json());

// State
let evmProvider = null;
let bridgeContract = null;
let wEdgeContract = null;
let relayerWallet = null;
let processedEdgeaiTxs = new Set();
let pendingBridgeRequests = [];

// Initialize EVM connection
async function initializeEVM() {
  try {
    evmProvider = new ethers.JsonRpcProvider(config.evmRpcUrl);
    
    if (config.relayerPrivateKey && config.bridgeContractAddress) {
      relayerWallet = new ethers.Wallet(config.relayerPrivateKey, evmProvider);
      bridgeContract = new ethers.Contract(config.bridgeContractAddress, BRIDGE_ABI, relayerWallet);
      wEdgeContract = new ethers.Contract(config.wEdgeContractAddress, WEDGE_ABI, evmProvider);
      
      logger.info('EVM connection initialized', {
        network: (await evmProvider.getNetwork()).chainId.toString(),
        relayer: relayerWallet.address
      });
    } else {
      logger.warn('EVM contracts not configured - running in demo mode');
    }
  } catch (error) {
    logger.error('Failed to initialize EVM connection', { error: error.message });
  }
}

// Check EdgeAI Chain for bridge requests
async function checkEdgeaiBridgeRequests() {
  try {
    // Query EdgeAI API for pending bridge transactions
    const response = await axios.get(`${config.edgeaiApiUrl}/api/bridge/pending`);
    
    if (response.data.success && response.data.data) {
      for (const request of response.data.data) {
        if (!processedEdgeaiTxs.has(request.txHash)) {
          await processBridgeToEVM(request);
          processedEdgeaiTxs.add(request.txHash);
        }
      }
    }
  } catch (error) {
    // API might not exist yet, that's okay
    if (error.response?.status !== 404) {
      logger.debug('EdgeAI bridge check', { error: error.message });
    }
  }
}

// Process bridge request from EdgeAI to EVM
async function processBridgeToEVM(request) {
  if (!bridgeContract || !relayerWallet) {
    logger.warn('Bridge contract not configured, storing request for later');
    pendingBridgeRequests.push(request);
    return;
  }
  
  try {
    const amountWei = ethers.parseEther(request.amount.toString());
    
    logger.info('Processing bridge to EVM', {
      recipient: request.evmAddress,
      amount: request.amount,
      txHash: request.txHash
    });
    
    const tx = await bridgeContract.processBridgeToEVM(
      request.evmAddress,
      amountWei,
      request.txHash
    );
    
    await tx.wait();
    
    logger.info('Bridge to EVM completed', {
      evmTxHash: tx.hash,
      edgeaiTxHash: request.txHash
    });
    
    return tx.hash;
  } catch (error) {
    logger.error('Failed to process bridge to EVM', { error: error.message });
    throw error;
  }
}

// Process bridge request from EVM to EdgeAI
async function processBridgeToEdgeAI(evmTxHash, edgeaiAddress, amount) {
  try {
    logger.info('Processing bridge to EdgeAI', {
      evmTxHash,
      edgeaiAddress,
      amount
    });
    
    // Call EdgeAI API to release tokens
    const response = await axios.post(`${config.edgeaiApiUrl}/api/bridge/release`, {
      evmTxHash,
      edgeaiAddress,
      amount: amount.toString()
    });
    
    if (response.data.success) {
      logger.info('Bridge to EdgeAI completed', {
        edgeaiTxHash: response.data.data.txHash
      });
      return response.data.data.txHash;
    } else {
      throw new Error(response.data.error || 'Unknown error');
    }
  } catch (error) {
    logger.error('Failed to process bridge to EdgeAI', { error: error.message });
    throw error;
  }
}

// API Routes

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    evmConnected: !!evmProvider,
    bridgeConfigured: !!bridgeContract
  });
});

// Get bridge status
app.get('/api/bridge/status', async (req, res) => {
  try {
    const status = {
      edgeaiChain: {
        url: config.edgeaiApiUrl,
        connected: false
      },
      evmChain: {
        url: config.evmRpcUrl,
        connected: false,
        chainId: null
      },
      contracts: {
        bridge: config.bridgeContractAddress || 'not configured',
        wEdge: config.wEdgeContractAddress || 'not configured'
      },
      stats: {
        totalBridgedToEVM: '0',
        totalBridgedToEdgeAI: '0',
        pendingRequests: pendingBridgeRequests.length
      }
    };
    
    // Check EdgeAI connection
    try {
      const edgeaiResponse = await axios.get(`${config.edgeaiApiUrl}/api/chain`, { timeout: 5000 });
      status.edgeaiChain.connected = edgeaiResponse.data.success;
    } catch (e) {
      status.edgeaiChain.connected = false;
    }
    
    // Check EVM connection
    if (evmProvider) {
      try {
        const network = await evmProvider.getNetwork();
        status.evmChain.connected = true;
        status.evmChain.chainId = network.chainId.toString();
      } catch (e) {
        status.evmChain.connected = false;
      }
    }
    
    // Get bridge stats
    if (bridgeContract) {
      try {
        const stats = await bridgeContract.getBridgeStats();
        status.stats.totalBridgedToEVM = ethers.formatEther(stats[0]);
        status.stats.totalBridgedToEdgeAI = ethers.formatEther(stats[1]);
      } catch (e) {
        logger.debug('Could not fetch bridge stats', { error: e.message });
      }
    }
    
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Initiate bridge from EdgeAI to EVM (called by EdgeAI backend)
app.post('/api/bridge/to-evm', async (req, res) => {
  try {
    const { evmAddress, amount, edgeaiTxHash, signature } = req.body;
    
    if (!evmAddress || !amount || !edgeaiTxHash) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Validate EVM address
    if (!ethers.isAddress(evmAddress)) {
      return res.status(400).json({ error: 'Invalid EVM address' });
    }
    
    // Store request for processing
    const request = {
      evmAddress,
      amount: parseFloat(amount),
      txHash: edgeaiTxHash,
      timestamp: Date.now(),
      status: 'pending'
    };
    
    // Try to process immediately
    try {
      const evmTxHash = await processBridgeToEVM(request);
      request.status = 'completed';
      request.evmTxHash = evmTxHash;
    } catch (e) {
      request.status = 'queued';
      pendingBridgeRequests.push(request);
    }
    
    res.json({
      success: true,
      data: request
    });
  } catch (error) {
    logger.error('Bridge to EVM request failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Get wEDGE balance for an address
app.get('/api/balance/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    if (!ethers.isAddress(address)) {
      return res.status(400).json({ error: 'Invalid address' });
    }
    
    if (!wEdgeContract) {
      return res.json({
        address,
        balance: '0',
        note: 'Contract not configured'
      });
    }
    
    const balance = await wEdgeContract.balanceOf(address);
    
    res.json({
      address,
      balance: ethers.formatEther(balance),
      balanceWei: balance.toString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get pending bridge requests
app.get('/api/bridge/pending', (req, res) => {
  res.json({
    success: true,
    data: pendingBridgeRequests.filter(r => r.status === 'pending' || r.status === 'queued')
  });
});

// Start server
async function start() {
  await initializeEVM();
  
  // Start periodic check for EdgeAI bridge requests
  setInterval(checkEdgeaiBridgeRequests, 30000); // Every 30 seconds
  
  app.listen(config.port, () => {
    logger.info(`Bridge relayer service started on port ${config.port}`);
    logger.info('Configuration:', {
      edgeaiApiUrl: config.edgeaiApiUrl,
      evmRpcUrl: config.evmRpcUrl,
      bridgeContract: config.bridgeContractAddress || 'not set',
      wEdgeContract: config.wEdgeContractAddress || 'not set'
    });
  });
}

start().catch(error => {
  logger.error('Failed to start bridge service', { error: error.message });
  process.exit(1);
});
