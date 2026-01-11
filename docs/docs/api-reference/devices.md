---
sidebar_position: 6
---

# Devices API

The Devices API provides endpoints for managing and interacting with IoT devices registered on the EdgeAI network.

## Get Device Statistics

Retrieves statistics about the registered devices on the network.

`GET /api/devices/stats`

### Response

```json
{
  "totalDevices": 5000,
  "activeDevices": 4500,
  "averageReputation": 95.5,
  "regionsCovered": 120
}
```

### SDK Usage

```typescript
const stats = await client.getDeviceStats();
console.log(`There are ${stats.activeDevices} active devices on the network.`);
```

## Get Device

Retrieves information about a specific device by its ID.

`GET /api/devices/{id}`

### Parameters

| Name | In   | Type   | Description                     |
| :--- | :--- | :----- | :------------------------------ |
| `id` | path | string | The unique ID of the device.    |

### Response

A [Device object](../sdk/types.md#device).

### SDK Usage

```typescript
const device = await client.getDevice("DEV-12345");
console.log(`Device Name: ${device.name}`);
```

## Get Devices (Paginated)

Retrieves a paginated list of devices, with optional filters.

`GET /api/devices`

### Query Parameters

| Name         | Type    | Description                                       |
| :----------- | :------ | :------------------------------------------------ |
| `page`       | integer | The page number to retrieve (default: 1).         |
| `pageSize`   | integer | The number of devices per page (default: 20).     |
| `owner`      | string  | Filter by the address of the device owner.        |
| `deviceType` | string  | Filter by the type of device (e.g., `Sensor`).    |
| `region`     | string  | Filter by geographic region.                      |

### Response

A [PaginatedResponse](../sdk/types.md#paginatedresponse) of [Device](../sdk/types.md#device) objects.

### SDK Usage

```typescript
const sensorDevices = await client.getDevices({ deviceType: 'Sensor' });
console.log(`Found ${sensorDevices.total} sensor devices.`);
```

## Register Device

Submits a transaction to register a new IoT device on the network.

`POST /api/devices/register`

### Request Body

A signed transaction with [RegisterDeviceParams](../sdk/types.md#registerdeviceparams).

### SDK Usage

```typescript
import { DeviceType } from '@edgeai/sdk';

// Simplified example
const txHash = await wallet.registerDevice({
  deviceType: DeviceType.Sensor,
  name: "My Weather Station",
  region: "US-West"
});
```

## Submit Data

Submits a data payload from a registered device. This is a core operation for the PoIE consensus mechanism.

`POST /api/devices/submit-data`

### Request Body

A signed transaction with [SubmitDataParams](../sdk/types.md#submitdataparams).

### SDK Usage

```typescript
// Simplified example
const txHash = await wallet.submitDeviceData({
  deviceId: "DEV-12345",
  dataType: "temperature",
  data: { value: 25.5, unit: "Celsius" }
});
```
