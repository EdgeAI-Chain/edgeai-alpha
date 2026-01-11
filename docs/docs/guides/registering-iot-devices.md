---
sidebar_position: 4
---

# Guide: Registering IoT Devices

The ability to register and manage IoT devices is a core feature of the EdgeAI network, powered by the Proof of Information Entropy (PoIE) consensus mechanism. By registering your device, you can contribute data to the network and earn rewards.

This guide explains how to register a device and submit data.

## The Device Lifecycle

1.  **Registration:** The device owner sends a transaction to register the device, specifying its type and other metadata. The network assigns a unique ID to the device.
2.  **Data Submission:** The registered device can then submit data payloads to the network. Each submission is a transaction that gets recorded on the blockchain.
3.  **Reputation Scoring:** The PoIE consensus engine analyzes the submitted data for quality, novelty, and consistency. Devices that provide high-quality data see their reputation score increase.
4.  **Rewards:** Devices earn rewards based on their reputation and the value of the data they contribute.

## Step 1: Register Your Device

To register a device, you need to send a transaction from the owner's wallet. You must specify the device type, a name, and its region.

```typescript
import { EdgeAIClient, DeviceType } from '@edgeai/sdk';

const client = new EdgeAIClient({ baseUrl: '...' });

// Simplified example
async function registerDevice() {
  const txHash = await wallet.registerDevice({
    deviceType: DeviceType.Weather,
    name: "My Backyard Weather Station",
    region: "EU-Central",
    metadata: {
      model: "WX-2000",
      sensors: ["temperature", "humidity", "pressure"],
    },
  });

  console.log(`Device registration transaction sent: ${txHash}`);
  // After confirmation, you can get the device ID from the transaction receipt.
}
```

## Step 2: Submit Data from the Device

Once registered, the device can start submitting data. Each data submission must be signed, either by the device itself (if it has a secure key store) or by a proxy service managed by the owner.

```typescript
// Simplified example
async function submitData(deviceId: string) {
  const temperatureReading = { value: 21.3, unit: "Celsius" };

  const txHash = await deviceWallet.submitDeviceData({
    deviceId: deviceId,
    dataType: "temperature",
    data: temperatureReading,
    timestamp: new Date().toISOString(),
  });

  console.log(`Data submission transaction sent: ${txHash}`);
}
```

## Step 3: Monitor Your Device

You can query the network to check the status and reputation of your device.

```typescript
async function checkDevice(deviceId: string) {
  const device = await client.getDevice(deviceId);

  console.log(`Device Name: ${device.name}`);
  console.log(`Reputation Score: ${device.reputation}`);
  console.log(`Total Contributions: ${device.contributions}`);
  console.log(`Is Active: ${device.isActive}`);
}
```

By contributing high-quality data, your device will build its reputation, leading to greater rewards and a more trusted status on the EdgeAI network. This creates a powerful incentive for deploying and maintaining a healthy, reliable network of IoT devices.
