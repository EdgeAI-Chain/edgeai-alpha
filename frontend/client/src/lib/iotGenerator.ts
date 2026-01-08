import { Transaction } from './api';

// IoT Sectors and their specific device types
const SECTORS = [
  {
    id: 'smart_city',
    name: 'Smart City',
    icon: 'Building2',
    devices: ['Traffic Cam', 'Street Light', 'Air Quality Sensor', 'Parking Meter', 'Waste Bin Sensor'],
    payloads: [
      () => `{"traffic_density": "${['low', 'medium', 'high'][Math.floor(Math.random() * 3)]}", "avg_speed": ${Math.floor(Math.random() * 80)}kmh}`,
      () => `{"co2_ppm": ${350 + Math.floor(Math.random() * 150)}, "pm25": ${Math.floor(Math.random() * 50)}}`,
      () => `{"occupancy": ${Math.random() > 0.5}, "zone": "A-${Math.floor(Math.random() * 100)}"}`
    ]
  },
  {
    id: 'industrial',
    name: 'Industrial IoT',
    icon: 'Factory',
    devices: ['Pressure Valve', 'Robotic Arm', 'Temp Controller', 'Conveyor Belt', 'Hydraulic Pump'],
    payloads: [
      () => `{"pressure_psi": ${900 + Math.floor(Math.random() * 300)}, "status": "optimal"}`,
      () => `{"rpm": ${1200 + Math.floor(Math.random() * 500)}, "vibration": ${Math.random().toFixed(3)}}`,
      () => `{"temp_c": ${40 + Math.floor(Math.random() * 40)}, "cooling": ${Math.random() > 0.3}}`
    ]
  },
  {
    id: 'agriculture',
    name: 'Smart Agriculture',
    icon: 'Leaf',
    devices: ['Soil Moisture Sensor', 'Drone Scout', 'Weather Station', 'Irrigation Pump', 'Livestock Tracker'],
    payloads: [
      () => `{"moisture": ${20 + Math.floor(Math.random() * 60)}%, "ph": ${(5.5 + Math.random() * 2).toFixed(1)}}`,
      () => `{"wind_speed": ${Math.floor(Math.random() * 30)}kmh, "rain_mm": ${Math.floor(Math.random() * 10)}}`,
      () => `{"lat": ${(Math.random() * 180 - 90).toFixed(4)}, "lng": ${(Math.random() * 360 - 180).toFixed(4)}}`
    ]
  },
  {
    id: 'healthcare',
    name: 'Healthcare',
    icon: 'HeartPulse',
    devices: ['Heart Rate Monitor', 'Insulin Pump', 'Sleep Tracker', 'Smart Scale', 'Activity Band'],
    payloads: [
      () => `{"bpm": ${60 + Math.floor(Math.random() * 40)}, "spo2": ${95 + Math.floor(Math.random() * 5)}%}`,
      () => `{"glucose_mgdl": ${80 + Math.floor(Math.random() * 60)}, "trend": "stable"}`,
      () => `{"steps": ${Math.floor(Math.random() * 10000)}, "cal": ${Math.floor(Math.random() * 500)}}`
    ]
  },
  {
    id: 'logistics',
    name: 'Logistics',
    icon: 'Truck',
    devices: ['Fleet Tracker', 'Cargo Sensor', 'Cold Chain Monitor', 'RFID Scanner', 'Warehouse Bot'],
    payloads: [
      () => `{"lat": ${(Math.random() * 180 - 90).toFixed(4)}, "lng": ${(Math.random() * 360 - 180).toFixed(4)}, "speed": ${Math.floor(Math.random() * 100)}kmh}`,
      () => `{"temp_c": ${-20 + Math.floor(Math.random() * 30)}, "humidity": ${Math.floor(Math.random() * 100)}%}`,
      () => `{"scan_id": "PKG-${Math.floor(Math.random() * 10000)}", "status": "in_transit"}`
    ]
  },
  {
    id: 'energy',
    name: 'Energy Grid',
    icon: 'Zap',
    devices: ['Smart Meter', 'Solar Inverter', 'Grid Monitor', 'Battery Storage', 'EV Charger'],
    payloads: [
      () => `{"voltage": ${220 + Math.floor(Math.random() * 20)}, "current": ${Math.floor(Math.random() * 50)}A}`,
      () => `{"output_kw": ${(Math.random() * 10).toFixed(2)}, "efficiency": ${80 + Math.floor(Math.random() * 20)}%}`,
      () => `{"charge_level": ${Math.floor(Math.random() * 100)}%, "status": "charging"}`
    ]
  }
];

// Deterministic random number generator (Linear Congruential Generator)
class LCG {
  private seed: number;
  constructor(seed: number) {
    this.seed = seed;
  }
  next() {
    this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
    return this.seed / 4294967296;
  }
}

export interface IoTTransaction extends Transaction {
  sector: string;
  deviceType: string;
  location: string;
  coordinates: [number, number]; // [latitude, longitude]
  dataPayload: string;
  status: string;
  hash: string;
}

const LOCATIONS = [
  { name: "New York, USA", coords: [40.7128, -74.0060] },
  { name: "London, UK", coords: [51.5074, -0.1278] },
  { name: "Tokyo, Japan", coords: [35.6762, 139.6503] },
  { name: "Singapore", coords: [1.3521, 103.8198] },
  { name: "Berlin, Germany", coords: [52.5200, 13.4050] },
  { name: "Shanghai, China", coords: [31.2304, 121.4737] },
  { name: "Sydney, Australia", coords: [-33.8688, 151.2093] },
  { name: "Toronto, Canada", coords: [43.6532, -79.3832] },
  { name: "Paris, France", coords: [48.8566, 2.3522] },
  { name: "Seoul, South Korea", coords: [37.5665, 126.9780] },
  { name: "Mumbai, India", coords: [19.0760, 72.8777] },
  { name: "Sao Paulo, Brazil", coords: [-23.5505, -46.6333] },
  { name: "Dubai, UAE", coords: [25.2048, 55.2708] },
  { name: "Amsterdam, Netherlands", coords: [52.3676, 4.9041] },
  { name: "Stockholm, Sweden", coords: [59.3293, 18.0686] },
  { name: "San Francisco, USA", coords: [37.7749, -122.4194] },
  { name: "Bangalore, India", coords: [12.9716, 77.5946] },
  { name: "Shenzhen, China", coords: [22.5431, 114.0579] },
  { name: "Austin, USA", coords: [30.2672, -97.7431] },
  { name: "Tel Aviv, Israel", coords: [32.0853, 34.7818] }
];

export function generateIoTTransaction(index: number, totalCount: number = 100000): IoTTransaction {
  // Use index as seed for consistency
  const rng = new LCG(index + 12345);
  
  // Pick a sector based on index and some randomness
  // Ensure more even distribution by using modulo on index for base selection, then adding randomness
  const baseIndex = index % SECTORS.length;
  // 70% chance to follow sequential distribution, 30% chance for random sector
  const sectorIndex = rng.next() > 0.3 ? baseIndex : Math.floor(rng.next() * SECTORS.length);
  const sector = SECTORS[sectorIndex];
  
  // Pick a device
  const deviceIndex = Math.floor(rng.next() * sector.devices.length);
  const deviceType = sector.devices[deviceIndex];
  
  // Generate payload
  const payloadIndex = Math.floor(rng.next() * sector.payloads.length);
  const dataPayload = sector.payloads[payloadIndex](); 
  
  // Generate realistic looking hash
  const hash = '0x' + Math.floor(rng.next() * 1e16).toString(16) + Math.floor(rng.next() * 1e16).toString(16) + '...';
  
  // Generate amount (IoT micro-transactions)
  const amount = parseFloat((rng.next() * 5).toFixed(4));
  
  // Generate timestamp (reverse chronological)
  const now = Date.now();
  const timeOffset = index * 100; // 100ms apart
  const timestamp = new Date(now - timeOffset).toISOString();

  // Generate location with jitter
  const locationObj = LOCATIONS[Math.floor(rng.next() * LOCATIONS.length)];
  // Add some random jitter to coordinates so they don't stack perfectly
  const jitterLat = (rng.next() - 0.5) * 2; // +/- 1 degree
  const jitterLon = (rng.next() - 0.5) * 2; // +/- 1 degree
  
  const location = locationObj.name;
  const coordinates: [number, number] = [
    locationObj.coords[0] + jitterLat,
    locationObj.coords[1] + jitterLon
  ];

  return {
    id: hash, 
    tx_type: 'DataContribution',
    hash: hash,
    from: `0x${Math.floor(rng.next() * 1e8).toString(16)}...${Math.floor(rng.next() * 1e8).toString(16)}`,
    to: `0x${Math.floor(rng.next() * 1e8).toString(16)}...${Math.floor(rng.next() * 1e8).toString(16)}`,
    amount: amount,
    timestamp: timestamp,
    status: 'Confirmed',
    sector: sector.name,
    deviceType: deviceType,
    location: location,
    coordinates: coordinates,
    dataPayload: dataPayload
  };
}

export function getIoTTransactions(page: number, pageSize: number): IoTTransaction[] {
  const start = (page - 1) * pageSize;
  const txs = [];
  for (let i = 0; i < pageSize; i++) {
    txs.push(generateIoTTransaction(start + i));
  }
  return txs;
}
