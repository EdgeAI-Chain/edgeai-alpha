use chrono::Utc;
use crate::blockchain::transaction::{Transaction, TransactionType, TxOutput, DataQuality};

/// 线性同余生成器 (LCG) - 确定性随机数生成
struct LCG {
    seed: u64,
}

impl LCG {
    fn new(seed: u64) -> Self {
        LCG { seed }
    }

    fn next(&mut self) -> f64 {
        self.seed = self.seed.wrapping_mul(1664525).wrapping_add(1013904223) % 4294967296;
        self.seed as f64 / 4294967296.0
    }

    fn next_int(&mut self, max: usize) -> usize {
        (self.next() * max as f64) as usize
    }

    fn next_range(&mut self, min: u64, max: u64) -> u64 {
        min + (self.next() * (max - min) as f64) as u64
    }
}

/// IoT 设备类型
const DEVICE_TYPES: &[&str] = &[
    "Temperature Sensor", "Humidity Sensor", "Air Quality Monitor",
    "Traffic Camera", "Smart Meter", "Water Flow Sensor",
    "Vibration Sensor", "Pressure Gauge", "Light Sensor",
    "Motion Detector", "GPS Tracker", "Weather Station",
    "Soil Moisture Sensor", "Industrial Robot", "Drone",
    "Smart Thermostat", "EV Charger", "Solar Panel Monitor",
];

/// IoT 行业
const SECTORS: &[&str] = &[
    "SmartCity", "Industrial", "Agriculture", "Healthcare",
    "Energy", "Transportation", "Logistics", "Environmental",
];

/// 城市位置
const CITIES: &[&str] = &[
    "Singapore", "Tokyo", "Shanghai", "Seoul", "Hong Kong",
    "New York", "London", "Berlin", "Paris", "Sydney",
    "Dubai", "Mumbai", "São Paulo", "Toronto", "Amsterdam",
];

/// 模拟账户地址
const SIMULATED_ACCOUNTS: &[&str] = &[
    "iot_device_001", "iot_device_002", "iot_device_003",
    "iot_device_004", "iot_device_005", "iot_device_006",
    "iot_device_007", "iot_device_008", "iot_device_009",
    "iot_device_010", "smart_factory_a", "smart_factory_b",
    "city_sensor_hub", "agri_monitor_1", "health_node_1",
    "energy_grid_01", "transport_hub", "logistics_center",
];

/// 交易模拟器
pub struct TransactionSimulator {
    rng: LCG,
    tx_counter: u64,
}

impl TransactionSimulator {
    /// 创建新的交易模拟器
    pub fn new(seed: u64) -> Self {
        TransactionSimulator {
            rng: LCG::new(seed),
            tx_counter: 0,
        }
    }

    /// 基于区块索引创建模拟器（确保确定性）
    pub fn from_block_index(block_index: u64) -> Self {
        // 使用区块索引和时间戳组合作为种子
        let seed = block_index.wrapping_mul(1000003).wrapping_add(Utc::now().timestamp() as u64);
        Self::new(seed)
    }

    /// 生成指定数量的模拟交易
    pub fn generate_transactions(&mut self, count: usize) -> Vec<Transaction> {
        (0..count).map(|_| self.generate_single_transaction()).collect()
    }

    /// 生成单个模拟交易
    fn generate_single_transaction(&mut self) -> Transaction {
        self.tx_counter += 1;
        
        // 随机选择交易类型（加权）
        let tx_type_roll = self.rng.next();
        let tx_type = if tx_type_roll < 0.60 {
            TransactionType::DataContribution  // 60% IoT 数据上传
        } else if tx_type_roll < 0.85 {
            TransactionType::Transfer           // 25% 转账
        } else {
            TransactionType::DataPurchase       // 15% 数据购买
        };

        match tx_type {
            TransactionType::DataContribution => self.generate_data_contribution(),
            TransactionType::Transfer => self.generate_transfer(),
            TransactionType::DataPurchase => self.generate_data_purchase(),
            _ => self.generate_data_contribution(),
        }
    }

    /// 生成 IoT 数据贡献交易
    fn generate_data_contribution(&mut self) -> Transaction {
        let sender = SIMULATED_ACCOUNTS[self.rng.next_int(SIMULATED_ACCOUNTS.len())].to_string();
        let device_type = DEVICE_TYPES[self.rng.next_int(DEVICE_TYPES.len())];
        let sector = SECTORS[self.rng.next_int(SECTORS.len())];
        let city = CITIES[self.rng.next_int(CITIES.len())];
        
        // 生成传感器数据
        let sensor_data = self.generate_sensor_payload(device_type);
        
        let data = format!(
            r#"{{"device_type": "{}", "sector": "{}", "location": "{}", "data": {}, "timestamp": {}}}"#,
            device_type, sector, city, sensor_data, Utc::now().timestamp()
        );

        // 数据贡献奖励
        let reward_amount = self.rng.next_range(10, 100);
        let output = TxOutput {
            amount: reward_amount,
            recipient: sender.clone(),
            data_hash: Some(format!("data_{:016x}", self.rng.seed)),
        };

        Transaction::new(
            TransactionType::DataContribution,
            sender,
            vec![],
            vec![output],
            Some(data),
            1,
            21000,
        )
    }

    /// 生成转账交易
    fn generate_transfer(&mut self) -> Transaction {
        let sender_idx = self.rng.next_int(SIMULATED_ACCOUNTS.len());
        let mut receiver_idx = self.rng.next_int(SIMULATED_ACCOUNTS.len());
        while receiver_idx == sender_idx {
            receiver_idx = self.rng.next_int(SIMULATED_ACCOUNTS.len());
        }

        let sender = SIMULATED_ACCOUNTS[sender_idx].to_string();
        let receiver = SIMULATED_ACCOUNTS[receiver_idx].to_string();
        let amount = self.rng.next_range(100, 10000);

        let output = TxOutput {
            amount,
            recipient: receiver.clone(),
            data_hash: None,
        };

        let data = format!(
            r#"{{"type": "token_transfer", "from": "{}", "to": "{}", "amount": {}}}"#,
            sender, receiver, amount
        );

        Transaction::new(
            TransactionType::Transfer,
            sender,
            vec![],
            vec![output],
            Some(data),
            2,
            21000,
        )
    }

    /// 生成数据购买交易
    fn generate_data_purchase(&mut self) -> Transaction {
        let buyer_idx = self.rng.next_int(SIMULATED_ACCOUNTS.len());
        let seller_idx = (buyer_idx + 1) % SIMULATED_ACCOUNTS.len();

        let buyer = SIMULATED_ACCOUNTS[buyer_idx].to_string();
        let seller = SIMULATED_ACCOUNTS[seller_idx].to_string();
        let price = self.rng.next_range(50, 500);
        let data_id = format!("dataset_{:08x}", self.rng.seed);

        let output = TxOutput {
            amount: price,
            recipient: seller.clone(),
            data_hash: Some(data_id.clone()),
        };

        let data = format!(
            r#"{{"type": "data_purchase", "buyer": "{}", "seller": "{}", "data_id": "{}", "price": {}}}"#,
            buyer, seller, data_id, price
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

    /// 生成传感器数据载荷
    fn generate_sensor_payload(&mut self, device_type: &str) -> String {
        match device_type {
            "Temperature Sensor" => {
                let temp = 15.0 + self.rng.next() * 25.0;
                format!(r#"{{"temperature_c": {:.1}, "unit": "celsius"}}"#, temp)
            }
            "Humidity Sensor" => {
                let humidity = 30.0 + self.rng.next() * 60.0;
                format!(r#"{{"humidity_percent": {:.1}}}"#, humidity)
            }
            "Air Quality Monitor" => {
                let aqi = 20 + self.rng.next_int(180);
                let pm25 = self.rng.next_int(100);
                format!(r#"{{"aqi": {}, "pm25": {}}}"#, aqi, pm25)
            }
            "Traffic Camera" => {
                let vehicles = self.rng.next_int(200);
                let density = ["low", "medium", "high"][self.rng.next_int(3)];
                format!(r#"{{"vehicle_count": {}, "density": "{}"}}"#, vehicles, density)
            }
            "Smart Meter" => {
                let kwh = self.rng.next() * 50.0;
                format!(r#"{{"power_kwh": {:.2}, "status": "active"}}"#, kwh)
            }
            "Vibration Sensor" => {
                let freq = 10.0 + self.rng.next() * 100.0;
                let amplitude = self.rng.next() * 5.0;
                format!(r#"{{"frequency_hz": {:.1}, "amplitude_mm": {:.2}}}"#, freq, amplitude)
            }
            "Pressure Gauge" => {
                let pressure = 900 + self.rng.next_int(300);
                format!(r#"{{"pressure_psi": {}, "status": "normal"}}"#, pressure)
            }
            "GPS Tracker" => {
                let lat = -90.0 + self.rng.next() * 180.0;
                let lng = -180.0 + self.rng.next() * 360.0;
                let speed = self.rng.next_int(120);
                format!(r#"{{"lat": {:.4}, "lng": {:.4}, "speed_kmh": {}}}"#, lat, lng, speed)
            }
            "Soil Moisture Sensor" => {
                let moisture = 10.0 + self.rng.next() * 80.0;
                format!(r#"{{"moisture_percent": {:.1}, "depth_cm": 15}}"#, moisture)
            }
            "Solar Panel Monitor" => {
                let output = self.rng.next() * 5.0;
                let efficiency = 15.0 + self.rng.next() * 10.0;
                format!(r#"{{"output_kw": {:.2}, "efficiency_percent": {:.1}}}"#, output, efficiency)
            }
            _ => {
                let value = self.rng.next() * 100.0;
                format!(r#"{{"value": {:.2}, "unit": "generic"}}"#, value)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_transactions() {
        let mut simulator = TransactionSimulator::new(12345);
        let txs = simulator.generate_transactions(5);
        
        assert_eq!(txs.len(), 5);
        for tx in &txs {
            assert!(!tx.hash.is_empty());
            assert!(!tx.sender.is_empty());
        }
    }
}
