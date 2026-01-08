
import fetch from 'node-fetch';
import fs from 'fs';

// Configuration
const API_BASE_URL = "https://edgeai-blockchain-node.fly.dev/api";
const TOTAL_TRANSACTIONS = 100000;
const BATCH_SIZE = 5; // Transactions per second (approx)
const MINING_INTERVAL = 10000; // Mine a block every 10 seconds

// AIoT Device Types and Data Templates
const DEVICE_TYPES = [
  { type: 'sensor_temp', prefix: 'temp_sensor_', data: () => ({ temp: (20 + Math.random() * 10).toFixed(2), unit: 'C', status: 'active' }) },
  { type: 'sensor_humidity', prefix: 'humid_sensor_', data: () => ({ humidity: (40 + Math.random() * 30).toFixed(1), unit: '%', status: 'active' }) },
  { type: 'camera_ai', prefix: 'cam_ai_', data: () => ({ detected: Math.random() > 0.8 ? 'person' : 'none', confidence: (0.8 + Math.random() * 0.19).toFixed(2) }) },
  { type: 'smart_meter', prefix: 'meter_', data: () => ({ usage: (Math.random() * 5).toFixed(3), unit: 'kWh', voltage: 220 }) },
  { type: 'vibration', prefix: 'vib_', data: () => ({ frequency: (Math.random() * 100).toFixed(1), anomaly: Math.random() > 0.95 }) }
];

// State
let wallets = [];
let txCount = 0;

// Helper: Delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 1. Initialize Wallets (Simulate Devices)
async function initializeWallets(count = 20) {
  console.log(`Initializing ${count} AIoT device wallets...`);
  
  // Try to load from file first
  if (fs.existsSync('sim_wallets.json')) {
    wallets = JSON.parse(fs.readFileSync('sim_wallets.json'));
    console.log(`Loaded ${wallets.length} wallets from file.`);
    return;
  }

  for (let i = 0; i < count; i++) {
    try {
      const res = await fetch(`${API_BASE_URL}/wallet/generate`, { method: 'POST' });
      const wallet = await res.json();
      
      // Assign a device type
      const deviceType = DEVICE_TYPES[i % DEVICE_TYPES.length];
      wallet.deviceType = deviceType.type;
      wallet.deviceId = `${deviceType.prefix}${Math.floor(Math.random() * 10000)}`;
      
      wallets.push(wallet);
      
      // Fund the wallet from genesis
      await fetch(`${API_BASE_URL}/transactions/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'genesis',
          to: wallet.address,
          amount: 10000
        })
      });
      
      process.stdout.write('.');
    } catch (e) {
      console.error('Error creating wallet:', e.message);
    }
  }
  
  // Save wallets
  fs.writeFileSync('sim_wallets.json', JSON.stringify(wallets, null, 2));
  console.log('\nWallets initialized and funded.');
  
  // Mine a block to confirm funding
  await mineBlock();
}

// 2. Mine Block
async function mineBlock() {
  try {
    const miner = wallets[Math.floor(Math.random() * wallets.length)];
    const res = await fetch(`${API_BASE_URL}/mine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ validator: miner ? miner.address : 'system_miner' })
    });
    const data = await res.json();
    console.log(`\n⛏️  Block #${data.index} mined! Transactions: ${data.transactions.length}`);
  } catch (e) {
    console.error('Mining error:', e.message);
  }
}

// 3. Send AIoT Data Transaction
async function sendTransaction() {
  const sender = wallets[Math.floor(Math.random() * wallets.length)];
  const receiver = wallets[Math.floor(Math.random() * wallets.length)];
  
  if (!sender || !receiver || sender.address === receiver.address) return;

  // Find device config
  const deviceConfig = DEVICE_TYPES.find(d => d.type === sender.deviceType) || DEVICE_TYPES[0];
  const payloadData = deviceConfig.data();

  try {
    // Prepare
    const prepareRes = await fetch(`${API_BASE_URL}/wallet/transfer/prepare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: sender.address,
        to: receiver.address,
        amount: 1, // Micro-transaction
        payload: {
          device_id: sender.deviceId,
          type: 'data_upload',
          timestamp: Date.now(),
          data: payloadData
        }
      })
    });
    const prepareData = await prepareRes.json();

    // Sign
    const signRes = await fetch(`${API_BASE_URL}/wallet/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        private_key: sender.private_key,
        message: prepareData.message
      })
    });
    const signData = await signRes.json();

    // Submit
    const submitRes = await fetch(`${API_BASE_URL}/wallet/transfer/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: sender.address,
        to: receiver.address,
        amount: 1,
        signature: signData.signature,
        public_key: sender.public_key,
        payload: { // Re-attach payload as some nodes might need it in the submit body too, depending on implementation
          device_id: sender.deviceId,
          type: 'data_upload',
          timestamp: Date.now(),
          data: payloadData
        }
      })
    });
    
    if (submitRes.ok) {
      txCount++;
      process.stdout.write(`\r🚀 Tx Sent: ${txCount}/${TOTAL_TRANSACTIONS} | Device: ${sender.deviceId} | Type: ${sender.deviceType}`);
    } else {
      // console.error('Tx failed');
    }
  } catch (e) {
    // console.error('Tx Error:', e.message);
  }
}

// Main Loop
async function startSimulation() {
  console.log('🚀 Starting EdgeAI Traffic Simulation...');
  console.log(`Target: ${TOTAL_TRANSACTIONS} transactions`);
  
  await initializeWallets(50); // Create 50 simulated devices

  // Mining Loop
  setInterval(mineBlock, MINING_INTERVAL);

  // Transaction Loop
  while (txCount < TOTAL_TRANSACTIONS) {
    const promises = [];
    for (let i = 0; i < BATCH_SIZE; i++) {
      promises.push(sendTransaction());
    }
    await Promise.all(promises);
    await delay(1000); // Wait 1 second between batches
  }
  
  console.log('\n✅ Simulation Complete!');
}

startSimulation();
