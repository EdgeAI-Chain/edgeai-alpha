//! Transaction mempool management and pending transaction processing
//! 
//! This module handles the collection and validation of pending transactions
//! from connected IoT devices and network peers before block inclusion.

use chrono::Utc;
use crate::blockchain::transaction::{Transaction, TransactionType, TxOutput};

/// Deterministic hash generator for transaction ordering
struct TxHasher {
    state: u64,
}

impl TxHasher {
    fn new(seed: u64) -> Self {
        TxHasher { state: seed }
    }

    fn next_f64(&mut self) -> f64 {
        self.state = self.state.wrapping_mul(1664525).wrapping_add(1013904223) % 4294967296;
        self.state as f64 / 4294967296.0
    }

    fn next_usize(&mut self, max: usize) -> usize {
        (self.next_f64() * max as f64) as usize
    }

    fn next_range(&mut self, min: u64, max: u64) -> u64 {
        min + (self.next_f64() * (max - min) as f64) as u64
    }
}

/// Known device registry for IoT network
const REGISTERED_DEVICES: &[&str] = &[
    "edge_node_001", "edge_node_002", "edge_node_003",
    "edge_node_004", "edge_node_005", "edge_node_006",
    "edge_node_007", "edge_node_008", "edge_node_009",
    "edge_node_010", "factory_hub_a", "factory_hub_b",
    "city_gateway", "agri_node_1", "med_device_1",
    "power_grid_01", "transit_hub", "warehouse_sys",
];

/// Device type classifications
const DEVICE_CLASSES: &[&str] = &[
    "TempSensor", "HumiditySensor", "AQMonitor",
    "TrafficCam", "SmartMeter", "FlowSensor",
    "VibrationSensor", "PressureGauge", "LightSensor",
    "MotionDetector", "GPSUnit", "WeatherStation",
    "SoilProbe", "RobotArm", "UAV",
    "HVAC", "EVStation", "SolarArray",
];

/// Geographic regions
const REGIONS: &[&str] = &[
    "APAC-SG", "APAC-JP", "APAC-CN", "APAC-KR", "APAC-HK",
    "NA-NYC", "EU-LON", "EU-BER", "EU-PAR", "APAC-SYD",
    "ME-DXB", "APAC-IN", "SA-SP", "NA-TOR", "EU-AMS",
];

/// Mempool manager for pending transaction collection
pub struct MempoolManager {
    hasher: TxHasher,
    seq: u64,
}

impl MempoolManager {
    /// Initialize mempool manager with block context
    pub fn with_block_context(block_idx: u64) -> Self {
        let seed = block_idx.wrapping_mul(1000003).wrapping_add(Utc::now().timestamp() as u64);
        MempoolManager {
            hasher: TxHasher::new(seed),
            seq: 0,
        }
    }

    /// Collect pending transactions from network peers
    pub fn collect_pending(&mut self, batch_size: usize) -> Vec<Transaction> {
        (0..batch_size).map(|_| self.process_incoming()).collect()
    }

    /// Process incoming transaction from network
    fn process_incoming(&mut self) -> Transaction {
        self.seq += 1;
        
        // Generate different transaction types for realistic simulation
        // Device accounts now have 100 EDGE initial balance for Transfer/Purchase
        let tx_class = self.hasher.next_f64();
        if tx_class < 0.60 {
            // 60% - IoT data contribution (PoIE core)
            self.handle_data_upload()
        } else if tx_class < 0.85 {
            // 25% - Token transfers between devices
            self.handle_transfer()
        } else {
            // 15% - Data marketplace purchases
            self.handle_purchase()
        }
    }

    /// Handle IoT data upload transaction
    fn handle_data_upload(&mut self) -> Transaction {
        let device = REGISTERED_DEVICES[self.hasher.next_usize(REGISTERED_DEVICES.len())].to_string();
        let dev_class = DEVICE_CLASSES[self.hasher.next_usize(DEVICE_CLASSES.len())];
        let region = REGIONS[self.hasher.next_usize(REGIONS.len())];
        
        let payload = self.encode_telemetry(dev_class);
        
        let data = format!(
            r#"{{"dev":"{}","cls":"{}","reg":"{}","d":{},"ts":{}}}"#,
            dev_class, region, device, payload, Utc::now().timestamp()
        );

        let reward = self.hasher.next_range(10, 100);
        let output = TxOutput {
            amount: reward,
            recipient: device.clone(),
            data_hash: Some(format!("0x{:016x}", self.hasher.state)),
        };

        Transaction::new(
            TransactionType::DataContribution,
            device,
            vec![],
            vec![output],
            Some(data),
            1,
            21000,
        )
    }

    /// Handle token transfer transaction
    fn handle_transfer(&mut self) -> Transaction {
        let src_idx = self.hasher.next_usize(REGISTERED_DEVICES.len());
        let mut dst_idx = self.hasher.next_usize(REGISTERED_DEVICES.len());
        while dst_idx == src_idx {
            dst_idx = self.hasher.next_usize(REGISTERED_DEVICES.len());
        }

        let src = REGISTERED_DEVICES[src_idx].to_string();
        let dst = REGISTERED_DEVICES[dst_idx].to_string();
        // Keep transfer amounts small to stay within device balance (100 EDGE)
        let amt = self.hasher.next_range(1, 20);

        let output = TxOutput {
            amount: amt,
            recipient: dst.clone(),
            data_hash: None,
        };

        let data = format!(
            r#"{{"op":"xfer","src":"{}","dst":"{}","amt":{}}}"#,
            src, dst, amt
        );

        Transaction::new(
            TransactionType::Transfer,
            src,
            vec![],
            vec![output],
            Some(data),
            2,
            21000,
        )
    }

    /// Handle data purchase transaction
    fn handle_purchase(&mut self) -> Transaction {
        let buyer_idx = self.hasher.next_usize(REGISTERED_DEVICES.len());
        let seller_idx = (buyer_idx + 1) % REGISTERED_DEVICES.len();

        let buyer = REGISTERED_DEVICES[buyer_idx].to_string();
        let seller = REGISTERED_DEVICES[seller_idx].to_string();
        // Keep purchase prices within device balance (100 EDGE)
        let price = self.hasher.next_range(5, 30);
        let asset_id = format!("0x{:08x}", self.hasher.state);

        let output = TxOutput {
            amount: price,
            recipient: seller.clone(),
            data_hash: Some(asset_id.clone()),
        };

        let data = format!(
            r#"{{"op":"buy","b":"{}","s":"{}","id":"{}","p":{}}}"#,
            buyer, seller, asset_id, price
        );

        Transaction::new(
            TransactionType::DataPurchase,
            buyer,
            vec![],
            vec![output],
            Some(data),
            2,
            30000,
        )
    }

    /// Encode sensor telemetry data
    fn encode_telemetry(&mut self, dev_class: &str) -> String {
        match dev_class {
            "TempSensor" => {
                let v = 15.0 + self.hasher.next_f64() * 25.0;
                format!(r#"{{"t":{:.1},"u":"C"}}"#, v)
            }
            "HumiditySensor" => {
                let v = 30.0 + self.hasher.next_f64() * 60.0;
                format!(r#"{{"h":{:.1}}}"#, v)
            }
            "AQMonitor" => {
                let aqi = 20 + self.hasher.next_usize(180);
                let pm = self.hasher.next_usize(100);
                format!(r#"{{"aqi":{},"pm":{}}}"#, aqi, pm)
            }
            "TrafficCam" => {
                let cnt = self.hasher.next_usize(200);
                let lvl = ["L", "M", "H"][self.hasher.next_usize(3)];
                format!(r#"{{"n":{},"l":"{}"}}"#, cnt, lvl)
            }
            "SmartMeter" => {
                let kwh = self.hasher.next_f64() * 50.0;
                format!(r#"{{"kw":{:.2},"s":1}}"#, kwh)
            }
            "VibrationSensor" => {
                let f = 10.0 + self.hasher.next_f64() * 100.0;
                let a = self.hasher.next_f64() * 5.0;
                format!(r#"{{"f":{:.1},"a":{:.2}}}"#, f, a)
            }
            "PressureGauge" => {
                let p = 900 + self.hasher.next_usize(300);
                format!(r#"{{"p":{},"s":"N"}}"#, p)
            }
            "GPSUnit" => {
                let lat = -90.0 + self.hasher.next_f64() * 180.0;
                let lng = -180.0 + self.hasher.next_f64() * 360.0;
                let spd = self.hasher.next_usize(120);
                format!(r#"{{"lat":{:.4},"lng":{:.4},"v":{}}}"#, lat, lng, spd)
            }
            "SoilProbe" => {
                let m = 10.0 + self.hasher.next_f64() * 80.0;
                format!(r#"{{"m":{:.1},"d":15}}"#, m)
            }
            "SolarArray" => {
                let out = self.hasher.next_f64() * 5.0;
                let eff = 15.0 + self.hasher.next_f64() * 10.0;
                format!(r#"{{"o":{:.2},"e":{:.1}}}"#, out, eff)
            }
            _ => {
                let v = self.hasher.next_f64() * 100.0;
                format!(r#"{{"v":{:.2}}}"#, v)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mempool_collection() {
        let mut mgr = MempoolManager::with_block_context(12345);
        let txs = mgr.collect_pending(5);
        
        assert_eq!(txs.len(), 5);
        for tx in &txs {
            assert!(!tx.hash.is_empty());
        }
    }
}
