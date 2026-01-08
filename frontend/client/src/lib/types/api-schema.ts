/**
 * EdgeAI Explorer API Schema Definitions
 * 
 * This file defines the strict TypeScript interfaces for the backend API responses.
 * These types serve as the contract between the frontend and the backend.
 */

// --- Common Types ---

export interface PaginationParams {
  limit: number;
  offset: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  meta?: {
    total: number;
    page: number;
    limit: number;
  };
}

// --- Network Statistics ---

export interface NetworkStats {
  height: number;
  current_difficulty: number;
  network_hashrate: string; // e.g., "45.2 EH/s"
  active_validators: number;
  total_transactions: number;
  avg_block_time: number; // in seconds
  tps: number; // Transactions Per Second
}

// --- Blocks ---

export interface ValidatorSummary {
  name: string;
  address: string;
  signature?: string;
}

export interface Block {
  height: number; // Block number
  hash: string;
  timestamp: number; // Unix timestamp in seconds
  tx_count: number;
  validator: ValidatorSummary;
  size: number; // in bytes
  difficulty: number;
  previous_hash: string;
  entropy?: number; // Specific to EdgeAI consensus
}

// --- Transactions & IoT Data ---

export type IoTDeviceType = 'Traffic Sensor' | 'Weather Station' | 'Smart Meter' | 'Industrial Controller' | 'Medical Device' | 'Logistics Tracker' | 'Grid Monitor' | 'Unknown';
export type IoTSector = 'Smart City' | 'Smart Agriculture' | 'Energy Grid' | 'Healthcare' | 'Logistics' | 'Industrial IoT' | 'Unknown';

export interface GeoLocation {
  lat: number;
  lon: number;
  region?: string; // e.g., "New York, US"
}

export interface IoTMetadata {
  sector: IoTSector;
  device_type: IoTDeviceType;
  payload_summary: string; // Human-readable summary of the data
  location?: GeoLocation; // Origin of the data
  raw_data?: string; // Hex string of the payload
}

export interface Transaction {
  hash: string;
  block_height: number;
  from: string;
  to: string;
  value: string; // String to handle large numbers (Wei)
  timestamp: number;
  type: 'Transfer' | 'Contract_Call' | 'IoT_Data_Upload' | 'Validator_Join';
  status: 'success' | 'pending' | 'failed';
  fee: string;
  metadata?: IoTMetadata; // Optional, present only for IoT transactions
}

// --- Validators & Map ---

export interface ValidatorStats {
  uptime: string; // e.g., "99.9%"
  blocks_mined: number;
  last_seen: number; // Timestamp
  reputation_score?: number; // 0-100
}

export interface ValidatorNode {
  id: string;
  name: string;
  address: string;
  status: 'active' | 'inactive' | 'jailed';
  location: GeoLocation; // Required for 3D Globe
  stats: ValidatorStats;
}

// --- Charts ---

export type ChartTimeRange = '1h' | '24h' | '7d' | '30d' | 'all';

export interface ChartDataPoint {
  timestamp: number;
  tx_count?: number;
  hashrate?: number;
  difficulty?: number;
  price?: number;
}

export interface ChartResponse {
  range: ChartTimeRange;
  data: ChartDataPoint[];
}
