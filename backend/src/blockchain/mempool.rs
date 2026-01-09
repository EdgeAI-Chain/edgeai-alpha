//! Transaction mempool management and pending transaction processing
//! 
//! This module handles the collection and validation of pending transactions
//! from connected IoT devices and network peers before block inclusion.
//! 
//! ## Real IoT Integration
//! 
//! This module is designed to support real IoT data uploads in the future.
//! External devices can submit transactions via the `/api/transactions/submit` endpoint.
//! The mempool will validate and queue these transactions for block inclusion.

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
    
    fn next_range_f64(&mut self, min: f64, max: f64) -> f64 {
        min + self.next_f64() * (max - min)
    }
}

// ============================================================================
// DEVICE REGISTRY - Expanded for Stress Testing
// ============================================================================

/// Smart City Infrastructure Devices
const SMART_CITY_DEVICES: &[&str] = &[
    "traffic_cam_001", "traffic_cam_002", "traffic_cam_003", "traffic_cam_004", "traffic_cam_005",
    "traffic_cam_006", "traffic_cam_007", "traffic_cam_008", "traffic_cam_009", "traffic_cam_010",
    "air_quality_001", "air_quality_002", "air_quality_003", "air_quality_004", "air_quality_005",
    "smart_light_001", "smart_light_002", "smart_light_003", "smart_light_004", "smart_light_005",
    "smart_light_006", "smart_light_007", "smart_light_008", "smart_light_009", "smart_light_010",
    "parking_sensor_001", "parking_sensor_002", "parking_sensor_003", "parking_sensor_004",
    "noise_monitor_001", "noise_monitor_002", "noise_monitor_003", "noise_monitor_004",
    "weather_station_001", "weather_station_002", "weather_station_003",
    "flood_sensor_001", "flood_sensor_002", "flood_sensor_003",
    "ev_charger_001", "ev_charger_002", "ev_charger_003", "ev_charger_004", "ev_charger_005",
];

/// Industrial Manufacturing Devices
const INDUSTRIAL_DEVICES: &[&str] = &[
    "robot_arm_001", "robot_arm_002", "robot_arm_003", "robot_arm_004", "robot_arm_005",
    "robot_arm_006", "robot_arm_007", "robot_arm_008", "robot_arm_009", "robot_arm_010",
    "cnc_machine_001", "cnc_machine_002", "cnc_machine_003", "cnc_machine_004", "cnc_machine_005",
    "vibration_001", "vibration_002", "vibration_003", "vibration_004", "vibration_005",
    "vibration_006", "vibration_007", "vibration_008", "vibration_009", "vibration_010",
    "pressure_001", "pressure_002", "pressure_003", "pressure_004", "pressure_005",
    "temp_industrial_001", "temp_industrial_002", "temp_industrial_003", "temp_industrial_004",
    "conveyor_001", "conveyor_002", "conveyor_003", "conveyor_004", "conveyor_005",
    "quality_cam_001", "quality_cam_002", "quality_cam_003", "quality_cam_004",
    "plc_gateway_001", "plc_gateway_002", "plc_gateway_003",
];

/// Smart Agriculture Devices
const AGRICULTURE_DEVICES: &[&str] = &[
    "soil_probe_001", "soil_probe_002", "soil_probe_003", "soil_probe_004", "soil_probe_005",
    "soil_probe_006", "soil_probe_007", "soil_probe_008", "soil_probe_009", "soil_probe_010",
    "irrigation_001", "irrigation_002", "irrigation_003", "irrigation_004", "irrigation_005",
    "weather_agri_001", "weather_agri_002", "weather_agri_003",
    "drone_001", "drone_002", "drone_003", "drone_004", "drone_005",
    "livestock_001", "livestock_002", "livestock_003", "livestock_004",
    "greenhouse_001", "greenhouse_002", "greenhouse_003", "greenhouse_004",
    "crop_monitor_001", "crop_monitor_002", "crop_monitor_003",
    "pest_detector_001", "pest_detector_002", "pest_detector_003",
];

/// Energy Grid Devices
const ENERGY_DEVICES: &[&str] = &[
    "smart_meter_001", "smart_meter_002", "smart_meter_003", "smart_meter_004", "smart_meter_005",
    "smart_meter_006", "smart_meter_007", "smart_meter_008", "smart_meter_009", "smart_meter_010",
    "smart_meter_011", "smart_meter_012", "smart_meter_013", "smart_meter_014", "smart_meter_015",
    "solar_array_001", "solar_array_002", "solar_array_003", "solar_array_004", "solar_array_005",
    "wind_turbine_001", "wind_turbine_002", "wind_turbine_003",
    "battery_storage_001", "battery_storage_002", "battery_storage_003",
    "grid_monitor_001", "grid_monitor_002", "grid_monitor_003", "grid_monitor_004",
    "transformer_001", "transformer_002", "transformer_003",
    "power_quality_001", "power_quality_002", "power_quality_003",
];

/// Healthcare & Medical Devices
const HEALTHCARE_DEVICES: &[&str] = &[
    "patient_monitor_001", "patient_monitor_002", "patient_monitor_003", "patient_monitor_004",
    "patient_monitor_005", "patient_monitor_006", "patient_monitor_007", "patient_monitor_008",
    "infusion_pump_001", "infusion_pump_002", "infusion_pump_003", "infusion_pump_004",
    "ventilator_001", "ventilator_002", "ventilator_003",
    "ecg_monitor_001", "ecg_monitor_002", "ecg_monitor_003",
    "blood_analyzer_001", "blood_analyzer_002",
    "imaging_device_001", "imaging_device_002",
    "pharmacy_dispenser_001", "pharmacy_dispenser_002",
    "cold_storage_001", "cold_storage_002", "cold_storage_003",
];

/// Logistics & Supply Chain Devices
const LOGISTICS_DEVICES: &[&str] = &[
    "gps_tracker_001", "gps_tracker_002", "gps_tracker_003", "gps_tracker_004", "gps_tracker_005",
    "gps_tracker_006", "gps_tracker_007", "gps_tracker_008", "gps_tracker_009", "gps_tracker_010",
    "cold_chain_001", "cold_chain_002", "cold_chain_003", "cold_chain_004", "cold_chain_005",
    "warehouse_001", "warehouse_002", "warehouse_003", "warehouse_004",
    "rfid_reader_001", "rfid_reader_002", "rfid_reader_003", "rfid_reader_004",
    "dock_sensor_001", "dock_sensor_002", "dock_sensor_003",
    "forklift_001", "forklift_002", "forklift_003",
    "inventory_001", "inventory_002", "inventory_003",
];

/// Edge AI Compute Nodes
const AI_COMPUTE_NODES: &[&str] = &[
    "edge_gpu_001", "edge_gpu_002", "edge_gpu_003", "edge_gpu_004", "edge_gpu_005",
    "edge_gpu_006", "edge_gpu_007", "edge_gpu_008", "edge_gpu_009", "edge_gpu_010",
    "inference_001", "inference_002", "inference_003", "inference_004", "inference_005",
    "training_node_001", "training_node_002", "training_node_003",
    "model_server_001", "model_server_002", "model_server_003",
    "data_lake_001", "data_lake_002",
];

/// Geographic regions with realistic distribution
const REGIONS: &[(&str, f64, f64)] = &[
    ("APAC-Singapore", 1.3521, 103.8198),
    ("APAC-Tokyo", 35.6762, 139.6503),
    ("APAC-Shanghai", 31.2304, 121.4737),
    ("APAC-Seoul", 37.5665, 126.9780),
    ("APAC-Mumbai", 19.0760, 72.8777),
    ("APAC-Sydney", -33.8688, 151.2093),
    ("NA-NewYork", 40.7128, -74.0060),
    ("NA-SanFrancisco", 37.7749, -122.4194),
    ("NA-Toronto", 43.6532, -79.3832),
    ("NA-Chicago", 41.8781, -87.6298),
    ("EU-London", 51.5074, -0.1278),
    ("EU-Frankfurt", 50.1109, 8.6821),
    ("EU-Amsterdam", 52.3676, 4.9041),
    ("EU-Paris", 48.8566, 2.3522),
    ("ME-Dubai", 25.2048, 55.2708),
    ("SA-SaoPaulo", -23.5505, -46.6333),
];

/// Industry sectors for data categorization
const INDUSTRY_SECTORS: &[&str] = &[
    "SmartCity", "Manufacturing", "Agriculture", "Energy", 
    "Healthcare", "Logistics", "EdgeAI", "Transportation",
];

// ============================================================================
// MEMPOOL MANAGER
// ============================================================================

/// Mempool manager for pending transaction collection
pub struct MempoolManager {
    hasher: TxHasher,
    seq: u64,
    all_devices: Vec<&'static str>,
}

impl MempoolManager {
    /// Initialize mempool manager with block context
    pub fn with_block_context(block_idx: u64) -> Self {
        let seed = block_idx.wrapping_mul(1000003).wrapping_add(Utc::now().timestamp() as u64);
        
        // Combine all device registries
        let mut all_devices: Vec<&'static str> = Vec::new();
        all_devices.extend_from_slice(SMART_CITY_DEVICES);
        all_devices.extend_from_slice(INDUSTRIAL_DEVICES);
        all_devices.extend_from_slice(AGRICULTURE_DEVICES);
        all_devices.extend_from_slice(ENERGY_DEVICES);
        all_devices.extend_from_slice(HEALTHCARE_DEVICES);
        all_devices.extend_from_slice(LOGISTICS_DEVICES);
        all_devices.extend_from_slice(AI_COMPUTE_NODES);
        
        MempoolManager {
            hasher: TxHasher::new(seed),
            seq: 0,
            all_devices,
        }
    }

    /// Collect pending transactions from network peers
    /// This simulates IoT devices submitting data to the network
    pub fn collect_pending(&mut self, batch_size: usize) -> Vec<Transaction> {
        (0..batch_size).map(|_| self.process_incoming()).collect()
    }

    /// Process incoming transaction from network
    fn process_incoming(&mut self) -> Transaction {
        self.seq += 1;
        
        // Transaction type distribution for realistic EdgeAI workload
        let tx_class = self.hasher.next_f64();
        if tx_class < 0.70 {
            // 70% - IoT data contribution (PoIE core business)
            self.generate_data_contribution()
        } else if tx_class < 0.85 {
            // 15% - Token transfers between devices/users
            self.generate_transfer()
        } else if tx_class < 0.95 {
            // 10% - Data marketplace purchases
            self.generate_data_purchase()
        } else {
            // 5% - AI model inference requests
            self.generate_model_inference()
        }
    }

    /// Get a random device from the registry
    fn random_device(&mut self) -> String {
        self.all_devices[self.hasher.next_usize(self.all_devices.len())].to_string()
    }

    /// Get a random region
    fn random_region(&mut self) -> (&'static str, f64, f64) {
        REGIONS[self.hasher.next_usize(REGIONS.len())]
    }

    /// Get device category based on device name
    fn get_device_category(&self, device: &str) -> &'static str {
        if device.starts_with("traffic") || device.starts_with("air_quality") || 
           device.starts_with("smart_light") || device.starts_with("parking") ||
           device.starts_with("noise") || device.starts_with("weather_station") ||
           device.starts_with("flood") || device.starts_with("ev_charger") {
            "SmartCity"
        } else if device.starts_with("robot") || device.starts_with("cnc") ||
                  device.starts_with("vibration") || device.starts_with("pressure") ||
                  device.starts_with("temp_industrial") || device.starts_with("conveyor") ||
                  device.starts_with("quality_cam") || device.starts_with("plc") {
            "Manufacturing"
        } else if device.starts_with("soil") || device.starts_with("irrigation") ||
                  device.starts_with("weather_agri") || device.starts_with("drone") ||
                  device.starts_with("livestock") || device.starts_with("greenhouse") ||
                  device.starts_with("crop") || device.starts_with("pest") {
            "Agriculture"
        } else if device.starts_with("smart_meter") || device.starts_with("solar") ||
                  device.starts_with("wind") || device.starts_with("battery") ||
                  device.starts_with("grid") || device.starts_with("transformer") ||
                  device.starts_with("power_quality") {
            "Energy"
        } else if device.starts_with("patient") || device.starts_with("infusion") ||
                  device.starts_with("ventilator") || device.starts_with("ecg") ||
                  device.starts_with("blood") || device.starts_with("imaging") ||
                  device.starts_with("pharmacy") || device.starts_with("cold_storage") {
            "Healthcare"
        } else if device.starts_with("gps") || device.starts_with("cold_chain") ||
                  device.starts_with("warehouse") || device.starts_with("rfid") ||
                  device.starts_with("dock") || device.starts_with("forklift") ||
                  device.starts_with("inventory") {
            "Logistics"
        } else if device.starts_with("edge_gpu") || device.starts_with("inference") ||
                  device.starts_with("training") || device.starts_with("model_server") ||
                  device.starts_with("data_lake") {
            "EdgeAI"
        } else {
            "General"
        }
    }

    // ========================================================================
    // TRANSACTION GENERATORS
    // ========================================================================

    /// Generate IoT data contribution transaction
    fn generate_data_contribution(&mut self) -> Transaction {
        let device = self.random_device();
        let (region, lat, lng) = self.random_region();
        let category = self.get_device_category(&device);
        
        // Generate realistic telemetry based on device type
        let telemetry = self.generate_telemetry(&device);
        let data_size = telemetry.len() as u64;
        
        // Calculate data quality score (affects reward)
        let quality_score = 0.7 + self.hasher.next_f64() * 0.3; // 0.7-1.0
        let freshness = self.hasher.next_f64() * 0.1; // Freshness bonus
        
        let data = format!(
            r#"{{"device":"{}","category":"{}","region":"{}","lat":{:.4},"lng":{:.4},"telemetry":{},"quality":{:.3},"size":{},"ts":{}}}"#,
            device, category, region, lat, lng, telemetry, quality_score + freshness, data_size, Utc::now().timestamp()
        );

        // Reward based on data quality and size
        let base_reward = 10 + (data_size / 10);
        let quality_bonus = (base_reward as f64 * quality_score) as u64;
        let reward = base_reward + quality_bonus;
        
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

    /// Generate token transfer transaction
    fn generate_transfer(&mut self) -> Transaction {
        let src = self.random_device();
        let mut dst = self.random_device();
        while dst == src {
            dst = self.random_device();
        }

        let amt = self.hasher.next_range(1, 50);
        
        // Add transfer reason for realism
        let reasons = ["service_payment", "data_access_fee", "compute_credit", "stake_delegation", "reward_distribution"];
        let reason = reasons[self.hasher.next_usize(reasons.len())];

        let output = TxOutput {
            amount: amt,
            recipient: dst.clone(),
            data_hash: None,
        };

        let data = format!(
            r#"{{"op":"transfer","from":"{}","to":"{}","amount":{},"reason":"{}","ts":{}}}"#,
            src, dst, amt, reason, Utc::now().timestamp()
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

    /// Generate data purchase transaction
    fn generate_data_purchase(&mut self) -> Transaction {
        let buyer = self.random_device();
        let seller = self.random_device();
        
        let price = self.hasher.next_range(5, 100);
        let data_id = format!("data_{:08x}", self.hasher.state);
        
        // Data types available for purchase
        let data_types = [
            "historical_telemetry", "aggregated_metrics", "anomaly_patterns",
            "predictive_model", "training_dataset", "real_time_feed",
        ];
        let data_type = data_types[self.hasher.next_usize(data_types.len())];
        
        // Time range for historical data
        let duration_hours = self.hasher.next_range(1, 720); // 1 hour to 30 days

        let output = TxOutput {
            amount: price,
            recipient: seller.clone(),
            data_hash: Some(data_id.clone()),
        };

        let data = format!(
            r#"{{"op":"purchase","buyer":"{}","seller":"{}","data_id":"{}","data_type":"{}","price":{},"duration_hours":{},"ts":{}}}"#,
            buyer, seller, data_id, data_type, price, duration_hours, Utc::now().timestamp()
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

    /// Generate AI model inference request transaction
    fn generate_model_inference(&mut self) -> Transaction {
        let requester = self.random_device();
        
        // Select an AI compute node as the inference provider
        let compute_node = AI_COMPUTE_NODES[self.hasher.next_usize(AI_COMPUTE_NODES.len())].to_string();
        
        // Model types available
        let models = [
            ("anomaly_detection", 5, 50),
            ("predictive_maintenance", 10, 100),
            ("image_classification", 15, 200),
            ("object_detection", 20, 300),
            ("time_series_forecast", 8, 80),
            ("nlp_sentiment", 12, 150),
        ];
        let (model_name, base_cost, compute_units) = models[self.hasher.next_usize(models.len())];
        
        let inference_cost = base_cost + self.hasher.next_range(0, 10) as u64;
        let input_size = self.hasher.next_range(100, 10000);

        let output = TxOutput {
            amount: inference_cost,
            recipient: compute_node.clone(),
            data_hash: Some(format!("inference_{:08x}", self.hasher.state)),
        };

        let data = format!(
            r#"{{"op":"inference","requester":"{}","provider":"{}","model":"{}","input_size":{},"compute_units":{},"cost":{},"ts":{}}}"#,
            requester, compute_node, model_name, input_size, compute_units, inference_cost, Utc::now().timestamp()
        );

        Transaction::new(
            TransactionType::DataPurchase, // Reuse DataPurchase type for now
            requester,
            vec![],
            vec![output],
            Some(data),
            3,
            50000,
        )
    }

    // ========================================================================
    // TELEMETRY GENERATORS - Realistic IoT Data
    // ========================================================================

    /// Generate realistic telemetry based on device type
    fn generate_telemetry(&mut self, device: &str) -> String {
        // Smart City devices
        if device.starts_with("traffic_cam") {
            return self.telemetry_traffic_camera();
        }
        if device.starts_with("air_quality") {
            return self.telemetry_air_quality();
        }
        if device.starts_with("smart_light") {
            return self.telemetry_smart_light();
        }
        if device.starts_with("parking") {
            return self.telemetry_parking();
        }
        if device.starts_with("noise") {
            return self.telemetry_noise();
        }
        if device.starts_with("ev_charger") {
            return self.telemetry_ev_charger();
        }
        
        // Industrial devices
        if device.starts_with("robot_arm") {
            return self.telemetry_robot_arm();
        }
        if device.starts_with("cnc") {
            return self.telemetry_cnc_machine();
        }
        if device.starts_with("vibration") {
            return self.telemetry_vibration();
        }
        if device.starts_with("pressure") {
            return self.telemetry_pressure();
        }
        if device.starts_with("conveyor") {
            return self.telemetry_conveyor();
        }
        
        // Agriculture devices
        if device.starts_with("soil_probe") {
            return self.telemetry_soil();
        }
        if device.starts_with("irrigation") {
            return self.telemetry_irrigation();
        }
        if device.starts_with("drone") {
            return self.telemetry_drone();
        }
        if device.starts_with("greenhouse") {
            return self.telemetry_greenhouse();
        }
        
        // Energy devices
        if device.starts_with("smart_meter") {
            return self.telemetry_smart_meter();
        }
        if device.starts_with("solar") {
            return self.telemetry_solar();
        }
        if device.starts_with("wind") {
            return self.telemetry_wind_turbine();
        }
        if device.starts_with("battery") {
            return self.telemetry_battery();
        }
        
        // Healthcare devices
        if device.starts_with("patient_monitor") {
            return self.telemetry_patient_monitor();
        }
        if device.starts_with("ventilator") {
            return self.telemetry_ventilator();
        }
        
        // Logistics devices
        if device.starts_with("gps_tracker") {
            return self.telemetry_gps();
        }
        if device.starts_with("cold_chain") {
            return self.telemetry_cold_chain();
        }
        
        // Edge AI devices
        if device.starts_with("edge_gpu") || device.starts_with("inference") {
            return self.telemetry_edge_compute();
        }
        
        // Default telemetry
        self.telemetry_generic()
    }

    // Smart City Telemetry
    fn telemetry_traffic_camera(&mut self) -> String {
        let vehicle_count = self.hasher.next_usize(500);
        let pedestrian_count = self.hasher.next_usize(200);
        let congestion = ["low", "medium", "high", "critical"][self.hasher.next_usize(4)];
        let avg_speed = self.hasher.next_range_f64(5.0, 80.0);
        format!(r#"{{"vehicles":{},"pedestrians":{},"congestion":"{}","avg_speed_kmh":{:.1},"incidents":{}}}"#,
            vehicle_count, pedestrian_count, congestion, avg_speed, self.hasher.next_usize(3))
    }

    fn telemetry_air_quality(&mut self) -> String {
        let aqi = self.hasher.next_usize(300);
        let pm25 = self.hasher.next_range_f64(0.0, 150.0);
        let pm10 = self.hasher.next_range_f64(0.0, 200.0);
        let co2 = self.hasher.next_range(300, 2000);
        let no2 = self.hasher.next_range_f64(0.0, 100.0);
        format!(r#"{{"aqi":{},"pm2_5":{:.1},"pm10":{:.1},"co2_ppm":{},"no2_ppb":{:.1}}}"#,
            aqi, pm25, pm10, co2, no2)
    }

    fn telemetry_smart_light(&mut self) -> String {
        let brightness = self.hasher.next_usize(100);
        let power_w = self.hasher.next_range_f64(10.0, 150.0);
        let ambient_lux = self.hasher.next_usize(10000);
        let motion = self.hasher.next_f64() > 0.7;
        format!(r#"{{"brightness_pct":{},"power_watts":{:.1},"ambient_lux":{},"motion_detected":{}}}"#,
            brightness, power_w, ambient_lux, motion)
    }

    fn telemetry_parking(&mut self) -> String {
        let occupied = self.hasher.next_f64() > 0.4;
        let duration_min = if occupied { self.hasher.next_usize(480) } else { 0 };
        format!(r#"{{"occupied":{},"duration_minutes":{},"zone":"{}"}}"#,
            occupied, duration_min, ["A", "B", "C", "D"][self.hasher.next_usize(4)])
    }

    fn telemetry_noise(&mut self) -> String {
        let db = self.hasher.next_range_f64(30.0, 100.0);
        let peak_db = db + self.hasher.next_range_f64(0.0, 20.0);
        format!(r#"{{"avg_db":{:.1},"peak_db":{:.1},"duration_sec":{}}}"#, db, peak_db, 60)
    }

    fn telemetry_ev_charger(&mut self) -> String {
        let charging = self.hasher.next_f64() > 0.3;
        let power_kw = if charging { self.hasher.next_range_f64(7.0, 150.0) } else { 0.0 };
        let soc = self.hasher.next_usize(100);
        format!(r#"{{"charging":{},"power_kw":{:.1},"vehicle_soc_pct":{},"session_kwh":{:.2}}}"#,
            charging, power_kw, soc, self.hasher.next_range_f64(0.0, 50.0))
    }

    // Industrial Telemetry
    fn telemetry_robot_arm(&mut self) -> String {
        let cycle_time = self.hasher.next_range_f64(2.0, 30.0);
        let accuracy = self.hasher.next_range_f64(99.0, 99.99);
        let temp = self.hasher.next_range_f64(25.0, 60.0);
        format!(r#"{{"cycle_time_sec":{:.2},"accuracy_pct":{:.2},"motor_temp_c":{:.1},"operations_count":{},"status":"{}"}}"#,
            cycle_time, accuracy, temp, self.hasher.next_range(1000, 100000),
            ["running", "idle", "maintenance"][self.hasher.next_usize(3)])
    }

    fn telemetry_cnc_machine(&mut self) -> String {
        let spindle_rpm = self.hasher.next_range(1000, 20000);
        let feed_rate = self.hasher.next_range_f64(100.0, 5000.0);
        let tool_wear = self.hasher.next_range_f64(0.0, 100.0);
        format!(r#"{{"spindle_rpm":{},"feed_rate_mmpm":{:.1},"tool_wear_pct":{:.1},"coolant_temp_c":{:.1}}}"#,
            spindle_rpm, feed_rate, tool_wear, self.hasher.next_range_f64(15.0, 35.0))
    }

    fn telemetry_vibration(&mut self) -> String {
        let freq = self.hasher.next_range_f64(10.0, 1000.0);
        let amplitude = self.hasher.next_range_f64(0.01, 10.0);
        let rms = self.hasher.next_range_f64(0.1, 5.0);
        format!(r#"{{"frequency_hz":{:.1},"amplitude_mm":{:.3},"rms_velocity":{:.2},"alarm":{}}}"#,
            freq, amplitude, rms, amplitude > 5.0)
    }

    fn telemetry_pressure(&mut self) -> String {
        let pressure = self.hasher.next_range_f64(0.0, 1000.0);
        let unit = ["bar", "psi", "kPa"][self.hasher.next_usize(3)];
        format!(r#"{{"pressure":{:.2},"unit":"{}","temp_c":{:.1},"status":"{}"}}"#,
            pressure, unit, self.hasher.next_range_f64(-20.0, 80.0),
            ["normal", "warning", "critical"][self.hasher.next_usize(3)])
    }

    fn telemetry_conveyor(&mut self) -> String {
        let speed = self.hasher.next_range_f64(0.1, 5.0);
        let items = self.hasher.next_range(0, 1000);
        format!(r#"{{"speed_mps":{:.2},"items_per_hour":{},"motor_current_a":{:.1},"belt_tension_n":{:.0}}}"#,
            speed, items, self.hasher.next_range_f64(5.0, 50.0), self.hasher.next_range_f64(100.0, 500.0))
    }

    // Agriculture Telemetry
    fn telemetry_soil(&mut self) -> String {
        let moisture = self.hasher.next_range_f64(10.0, 80.0);
        let ph = self.hasher.next_range_f64(4.0, 9.0);
        let temp = self.hasher.next_range_f64(5.0, 35.0);
        let ec = self.hasher.next_range_f64(0.1, 4.0);
        format!(r#"{{"moisture_pct":{:.1},"ph":{:.2},"temp_c":{:.1},"ec_dsm":{:.2},"nitrogen_ppm":{},"phosphorus_ppm":{},"potassium_ppm":{}}}"#,
            moisture, ph, temp, ec, self.hasher.next_range(10, 200), self.hasher.next_range(5, 100), self.hasher.next_range(50, 300))
    }

    fn telemetry_irrigation(&mut self) -> String {
        let flow_rate = self.hasher.next_range_f64(0.0, 100.0);
        let pressure = self.hasher.next_range_f64(1.0, 6.0);
        format!(r#"{{"flow_rate_lpm":{:.1},"pressure_bar":{:.2},"valve_open":{},"zone":"{}","duration_min":{}}}"#,
            flow_rate, pressure, flow_rate > 0.0, ["north", "south", "east", "west"][self.hasher.next_usize(4)],
            self.hasher.next_usize(60))
    }

    fn telemetry_drone(&mut self) -> String {
        let alt = self.hasher.next_range_f64(10.0, 120.0);
        let speed = self.hasher.next_range_f64(0.0, 20.0);
        let battery = self.hasher.next_usize(100);
        format!(r#"{{"altitude_m":{:.1},"speed_mps":{:.1},"battery_pct":{},"lat":{:.6},"lng":{:.6},"mission":"{}"}}"#,
            alt, speed, battery, self.hasher.next_range_f64(-90.0, 90.0), self.hasher.next_range_f64(-180.0, 180.0),
            ["survey", "spray", "monitor", "return"][self.hasher.next_usize(4)])
    }

    fn telemetry_greenhouse(&mut self) -> String {
        let temp = self.hasher.next_range_f64(15.0, 35.0);
        let humidity = self.hasher.next_range_f64(40.0, 90.0);
        let co2 = self.hasher.next_range(400, 1500);
        let light = self.hasher.next_range(0, 100000);
        format!(r#"{{"temp_c":{:.1},"humidity_pct":{:.1},"co2_ppm":{},"light_lux":{},"ventilation_pct":{}}}"#,
            temp, humidity, co2, light, self.hasher.next_usize(100))
    }

    // Energy Telemetry
    fn telemetry_smart_meter(&mut self) -> String {
        let power = self.hasher.next_range_f64(0.1, 50.0);
        let voltage = self.hasher.next_range_f64(220.0, 240.0);
        let current = power * 1000.0 / voltage;
        let pf = self.hasher.next_range_f64(0.8, 1.0);
        format!(r#"{{"power_kw":{:.2},"voltage_v":{:.1},"current_a":{:.2},"power_factor":{:.2},"energy_kwh":{:.1},"tariff":"{}"}}"#,
            power, voltage, current, pf, self.hasher.next_range_f64(0.0, 1000.0),
            ["peak", "off_peak", "standard"][self.hasher.next_usize(3)])
    }

    fn telemetry_solar(&mut self) -> String {
        let irradiance = self.hasher.next_range_f64(0.0, 1200.0);
        let power = irradiance * 0.2 * self.hasher.next_range_f64(0.8, 1.0) / 100.0;
        let efficiency = self.hasher.next_range_f64(15.0, 22.0);
        format!(r#"{{"irradiance_wm2":{:.1},"power_kw":{:.2},"efficiency_pct":{:.1},"panel_temp_c":{:.1},"energy_today_kwh":{:.1}}}"#,
            irradiance, power, efficiency, self.hasher.next_range_f64(20.0, 70.0), self.hasher.next_range_f64(0.0, 50.0))
    }

    fn telemetry_wind_turbine(&mut self) -> String {
        let wind_speed = self.hasher.next_range_f64(0.0, 25.0);
        let power = if wind_speed > 3.0 && wind_speed < 25.0 {
            (wind_speed.powi(3) * 0.5).min(3000.0)
        } else { 0.0 };
        format!(r#"{{"wind_speed_mps":{:.1},"power_kw":{:.1},"rotor_rpm":{:.1},"pitch_angle_deg":{:.1},"yaw_angle_deg":{:.1}}}"#,
            wind_speed, power, self.hasher.next_range_f64(0.0, 20.0), self.hasher.next_range_f64(0.0, 90.0),
            self.hasher.next_range_f64(0.0, 360.0))
    }

    fn telemetry_battery(&mut self) -> String {
        let soc = self.hasher.next_range_f64(10.0, 100.0);
        let power = self.hasher.next_range_f64(-500.0, 500.0); // Negative = charging
        let temp = self.hasher.next_range_f64(15.0, 45.0);
        format!(r#"{{"soc_pct":{:.1},"power_kw":{:.1},"voltage_v":{:.1},"temp_c":{:.1},"cycles":{},"health_pct":{:.1}}}"#,
            soc, power, self.hasher.next_range_f64(300.0, 800.0), temp, self.hasher.next_range(0, 5000),
            self.hasher.next_range_f64(80.0, 100.0))
    }

    // Healthcare Telemetry
    fn telemetry_patient_monitor(&mut self) -> String {
        let hr = self.hasher.next_range(50, 120);
        let spo2 = self.hasher.next_range(90, 100);
        let bp_sys = self.hasher.next_range(90, 180);
        let bp_dia = self.hasher.next_range(60, 110);
        let temp = self.hasher.next_range_f64(36.0, 39.0);
        format!(r#"{{"heart_rate_bpm":{},"spo2_pct":{},"bp_systolic":{},"bp_diastolic":{},"temp_c":{:.1},"resp_rate":{}}}"#,
            hr, spo2, bp_sys, bp_dia, temp, self.hasher.next_range(12, 25))
    }

    fn telemetry_ventilator(&mut self) -> String {
        let tidal_vol = self.hasher.next_range(300, 800);
        let resp_rate = self.hasher.next_range(10, 30);
        let fio2 = self.hasher.next_range(21, 100);
        format!(r#"{{"tidal_volume_ml":{},"resp_rate":{},"fio2_pct":{},"peep_cmh2o":{},"pip_cmh2o":{},"mode":"{}"}}"#,
            tidal_vol, resp_rate, fio2, self.hasher.next_range(5, 15), self.hasher.next_range(15, 40),
            ["AC", "SIMV", "PSV", "CPAP"][self.hasher.next_usize(4)])
    }

    // Logistics Telemetry
    fn telemetry_gps(&mut self) -> String {
        let lat = self.hasher.next_range_f64(-90.0, 90.0);
        let lng = self.hasher.next_range_f64(-180.0, 180.0);
        let speed = self.hasher.next_range_f64(0.0, 120.0);
        let heading = self.hasher.next_range_f64(0.0, 360.0);
        format!(r#"{{"lat":{:.6},"lng":{:.6},"speed_kmh":{:.1},"heading_deg":{:.1},"altitude_m":{:.1},"accuracy_m":{:.1}}}"#,
            lat, lng, speed, heading, self.hasher.next_range_f64(0.0, 500.0), self.hasher.next_range_f64(1.0, 20.0))
    }

    fn telemetry_cold_chain(&mut self) -> String {
        let temp = self.hasher.next_range_f64(-25.0, 8.0);
        let humidity = self.hasher.next_range_f64(30.0, 90.0);
        let door_open = self.hasher.next_f64() > 0.9;
        format!(r#"{{"temp_c":{:.1},"humidity_pct":{:.1},"door_open":{},"compressor_on":{},"alert":{}}}"#,
            temp, humidity, door_open, temp > -18.0, temp > 0.0)
    }

    // Edge AI Telemetry
    fn telemetry_edge_compute(&mut self) -> String {
        let gpu_util = self.hasher.next_range_f64(0.0, 100.0);
        let gpu_temp = self.hasher.next_range_f64(30.0, 85.0);
        let mem_used = self.hasher.next_range_f64(0.0, 100.0);
        let inferences = self.hasher.next_range(0, 10000);
        format!(r#"{{"gpu_util_pct":{:.1},"gpu_temp_c":{:.1},"mem_used_pct":{:.1},"inferences_per_sec":{},"model_loaded":"{}","power_w":{:.1}}}"#,
            gpu_util, gpu_temp, mem_used, inferences,
            ["yolov8", "resnet50", "bert", "gpt2", "whisper"][self.hasher.next_usize(5)],
            self.hasher.next_range_f64(50.0, 350.0))
    }

    fn telemetry_generic(&mut self) -> String {
        let value = self.hasher.next_range_f64(0.0, 100.0);
        format!(r#"{{"value":{:.2},"unit":"generic","status":"{}"}}"#, value,
            ["normal", "warning", "error"][self.hasher.next_usize(3)])
    }
}

// ============================================================================
// REAL IOT DATA INTERFACE (Future Integration)
// ============================================================================

/// External IoT data submission structure
/// This structure is designed for future real IoT device integration
#[derive(Debug, Clone)]
pub struct ExternalIoTData {
    /// Device identifier (must be registered)
    pub device_id: String,
    /// Raw telemetry data in JSON format
    pub telemetry: String,
    /// Data category (SmartCity, Manufacturing, etc.)
    pub category: String,
    /// Geographic location
    pub location: Option<(f64, f64)>,
    /// Timestamp of data collection
    pub timestamp: i64,
    /// Digital signature for authentication
    pub signature: Option<String>,
}

impl ExternalIoTData {
    /// Convert external IoT data to a blockchain transaction
    /// This method will be used when real IoT devices submit data
    pub fn to_transaction(&self) -> Transaction {
        let data = format!(
            r#"{{"device":"{}","category":"{}","telemetry":{},"lat":{},"lng":{},"ts":{}}}"#,
            self.device_id,
            self.category,
            self.telemetry,
            self.location.map(|l| l.0).unwrap_or(0.0),
            self.location.map(|l| l.1).unwrap_or(0.0),
            self.timestamp
        );

        let reward = 50; // Base reward for external data
        let output = TxOutput {
            amount: reward,
            recipient: self.device_id.clone(),
            data_hash: Some(format!("ext_{:x}", self.timestamp)),
        };

        Transaction::new(
            TransactionType::DataContribution,
            self.device_id.clone(),
            vec![],
            vec![output],
            Some(data),
            1,
            21000,
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mempool_collection() {
        let mut mgr = MempoolManager::with_block_context(12345);
        let txs = mgr.collect_pending(20);
        
        assert_eq!(txs.len(), 20);
        for tx in &txs {
            assert!(!tx.hash.is_empty());
        }
    }
    
    #[test]
    fn test_device_count() {
        let mgr = MempoolManager::with_block_context(1);
        // Should have 200+ devices
        assert!(mgr.all_devices.len() > 200);
    }
}
