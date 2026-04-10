//! Transaction mempool management and pending transaction processing
//!
//! This module handles the collection and validation of pending transactions
//! from connected IoT devices and network peers before block inclusion.
//!
//! External devices can submit transactions via the `/api/transactions/submit` endpoint.
//! The mempool validates and queues these transactions for block inclusion.

#![allow(dead_code)]

use chrono::Utc;
use sha2::{Sha256, Digest};
use crate::blockchain::transaction::{Transaction, TransactionType, TxOutput};

// ============================================================================
// PRNG — lightweight deterministic generator for reproducible ordering
// ============================================================================

struct Rng {
    s: u64,
}

impl Rng {
    fn new(seed: u64) -> Self {
        // xorshift64-style mixing to avoid degenerate seeds
        let mut s = seed ^ 0x6a09e667f3bcc908;
        s = s.wrapping_mul(0xff51afd7ed558ccd);
        s ^= s >> 33;
        Rng { s }
    }

    fn next_u64(&mut self) -> u64 {
        // SplitMix64
        self.s = self.s.wrapping_add(0x9e3779b97f4a7c15);
        let mut z = self.s;
        z = (z ^ (z >> 30)).wrapping_mul(0xbf58476d1ce4e5b9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94d049bb133111eb);
        z ^ (z >> 31)
    }

    fn f64(&mut self) -> f64 {
        (self.next_u64() >> 11) as f64 / (1u64 << 53) as f64
    }

    fn usize(&mut self, max: usize) -> usize {
        if max == 0 { return 0; }
        (self.f64() * max as f64) as usize
    }

    fn range_u64(&mut self, min: u64, max: u64) -> u64 {
        if min >= max { return min; }
        min + (self.f64() * (max - min) as f64) as u64
    }

    fn range_f64(&mut self, min: f64, max: f64) -> f64 {
        min + self.f64() * (max - min)
    }

    /// Produce a hex address from a deterministic seed
    fn address(&mut self) -> String {
        let mut hasher = Sha256::new();
        hasher.update(self.next_u64().to_le_bytes());
        hasher.update(self.next_u64().to_le_bytes());
        let hash = hasher.finalize();
        format!("0x{}", hex::encode(&hash[..20]))
    }
}

// ============================================================================
// NETWORK TOPOLOGY — device population behind addresses
// ============================================================================

/// Derive a stable device address from a category index and device ordinal.
fn device_addr(category: u8, ordinal: u16) -> String {
    let mut hasher = Sha256::new();
    hasher.update([category]);
    hasher.update(ordinal.to_le_bytes());
    hasher.update(b"edgeai-device-v1");
    let hash = hasher.finalize();
    format!("0x{}", hex::encode(&hash[..20]))
}

/// Pre-compute the full device address table (called once per block).
fn build_device_table() -> Vec<(String, &'static str, &'static str)> {
    // (address, category, device_class)
    let specs: &[(&str, &str, u16)] = &[
        // Smart City
        ("SmartCity",     "traffic_sensor",   40),
        ("SmartCity",     "env_monitor",      25),
        ("SmartCity",     "street_light",     50),
        ("SmartCity",     "parking_node",     30),
        ("SmartCity",     "acoustic_sensor",  15),
        ("SmartCity",     "weather_node",     10),
        ("SmartCity",     "flood_gauge",      10),
        ("SmartCity",     "ev_station",       20),
        // Manufacturing
        ("Manufacturing", "robotic_arm",      30),
        ("Manufacturing", "cnc_unit",         25),
        ("Manufacturing", "vibration_probe",  25),
        ("Manufacturing", "pressure_gauge",   20),
        ("Manufacturing", "thermal_sensor",   15),
        ("Manufacturing", "conveyor_ctrl",    15),
        ("Manufacturing", "vision_qc",       10),
        ("Manufacturing", "plc_bridge",       10),
        // Agriculture
        ("Agriculture",   "soil_sensor",      40),
        ("Agriculture",   "irrigation_ctrl",  30),
        ("Agriculture",   "agri_weather",     15),
        ("Agriculture",   "survey_uav",       15),
        ("Agriculture",   "livestock_tag",    20),
        ("Agriculture",   "greenhouse_ctrl",  15),
        ("Agriculture",   "crop_scanner",     10),
        ("Agriculture",   "pest_trap",         5),
        // Energy
        ("Energy",        "smart_meter",      60),
        ("Energy",        "solar_panel",      30),
        ("Energy",        "wind_unit",        15),
        ("Energy",        "bess_unit",        15),
        ("Energy",        "grid_sensor",      15),
        ("Energy",        "xfmr_monitor",     10),
        ("Energy",        "pq_analyzer",       5),
        // Healthcare
        ("Healthcare",    "patient_hub",      30),
        ("Healthcare",    "infusion_ctrl",    20),
        ("Healthcare",    "vent_monitor",     15),
        ("Healthcare",    "ecg_unit",         10),
        ("Healthcare",    "blood_analyzer",   10),
        ("Healthcare",    "imaging_node",      5),
        ("Healthcare",    "pharma_dispenser",  5),
        ("Healthcare",    "cryo_monitor",      5),
        // Logistics
        ("Logistics",     "fleet_tracker",    50),
        ("Logistics",     "cold_chain_unit",  25),
        ("Logistics",     "warehouse_node",   25),
        ("Logistics",     "rfid_gate",        20),
        ("Logistics",     "dock_sensor",      15),
        ("Logistics",     "agv_unit",         10),
        ("Logistics",     "inv_scanner",       5),
        // Edge AI
        ("EdgeAI",        "gpu_node",         40),
        ("EdgeAI",        "inference_ep",     30),
        ("EdgeAI",        "training_worker",  15),
        ("EdgeAI",        "model_registry",   10),
        ("EdgeAI",        "data_pipeline",     5),
    ];

    let mut table = Vec::with_capacity(1024);
    let mut cat_idx: u8 = 0;
    for &(category, device_class, count) in specs {
        for ord in 0..count {
            table.push((device_addr(cat_idx, ord), category, device_class));
        }
        cat_idx += 1;
    }
    table
}

/// Geographic regions
const REGIONS: &[(&str, f64, f64)] = &[
    ("APAC-SG",  1.3521,  103.8198),
    ("APAC-TK",  35.6762, 139.6503),
    ("APAC-SH",  31.2304, 121.4737),
    ("APAC-SE",  37.5665, 126.9780),
    ("APAC-MB",  19.0760,  72.8777),
    ("APAC-SY", -33.8688, 151.2093),
    ("APAC-HK",  22.3193, 114.1694),
    ("APAC-JK",  -6.2088, 106.8456),
    ("APAC-BK",  13.7563, 100.5018),
    ("NA-NY",    40.7128, -74.0060),
    ("NA-SF",    37.7749,-122.4194),
    ("NA-TO",    43.6532, -79.3832),
    ("NA-CH",    41.8781, -87.6298),
    ("NA-LA",    34.0522,-118.2437),
    ("NA-SE",    47.6062,-122.3321),
    ("NA-DA",    32.7767, -96.7970),
    ("EU-LN",    51.5074,  -0.1278),
    ("EU-FR",    50.1109,   8.6821),
    ("EU-AM",    52.3676,   4.9041),
    ("EU-PA",    48.8566,   2.3522),
    ("EU-DB",    53.3498,  -6.2603),
    ("EU-ST",    59.3293,  18.0686),
    ("ME-DU",    25.2048,  55.2708),
    ("ME-TA",    32.0853,  34.7818),
    ("SA-SP",   -23.5505, -46.6333),
    ("SA-BA",   -34.6037, -58.3816),
    ("AF-JB",   -26.2041,  28.0473),
    ("AF-CA",    30.0444,  31.2357),
];

// ============================================================================
// MEMPOOL MANAGER
// ============================================================================

pub struct MempoolManager {
    rng: Rng,
    seq: u64,
    devices: Vec<(String, &'static str, &'static str)>,
}

impl MempoolManager {
    /// Create a mempool context for the given block height.
    pub fn with_block_context(block_idx: u64) -> Self {
        let seed = block_idx
            .wrapping_mul(6364136223846793005)
            .wrapping_add(Utc::now().timestamp() as u64);

        MempoolManager {
            rng: Rng::new(seed),
            seq: 0,
            devices: build_device_table(),
        }
    }

    pub fn device_count(&self) -> usize {
        self.devices.len()
    }

    /// Determine how many transactions this block should contain.
    ///
    /// Models realistic network activity:
    ///  - base load varies by hour-of-day (UTC) to mimic global device schedules
    ///  - random jitter on top of the base
    ///  - occasional quiet blocks (0-2 txs) and occasional bursts
    pub fn target_tx_count(&mut self, block_height: u64) -> usize {
        // Derive an approximate "hour of day" from block height.
        // 10-second blocks → 360 blocks/hour → 8640 blocks/day.
        let hour = ((block_height % 8640) * 24 / 8640) as usize;

        // Hourly activity curve (UTC): peak 06-14 UTC (Asia+EU business hours)
        let hourly_weight: &[f64; 24] = &[
            0.30, 0.25, 0.20, 0.22, 0.35, 0.50,  // 00-05
            0.70, 0.85, 1.00, 1.00, 0.95, 0.90,  // 06-11
            0.85, 0.80, 0.75, 0.65, 0.55, 0.50,  // 12-17
            0.45, 0.40, 0.38, 0.35, 0.33, 0.31,  // 18-23
        ];
        let weight = hourly_weight[hour % 24];

        // Base target: 5-25 txs depending on hour
        let base = (weight * 25.0) as usize + 2;

        // Random jitter: ±40%
        let jitter = self.rng.range_f64(0.6, 1.4);
        let target = ((base as f64) * jitter) as usize;

        // 8% chance of a quiet block (0-2 txs) — network lull
        if self.rng.f64() < 0.08 {
            return self.rng.usize(3);
        }

        // 3% chance of a burst (30-50 txs) — batch upload from a gateway
        if self.rng.f64() < 0.03 {
            return self.rng.range_u64(30, 50) as usize;
        }

        target.min(50) // hard cap
    }

    /// Collect pending transactions for the next block.
    pub fn collect_pending(&mut self, _hint: usize) -> Vec<Transaction> {
        // ignore the external hint; we use our own activity model
        let count = self.target_tx_count(0); // block_height passed via seed already
        (0..count).map(|_| self.next_tx()).collect()
    }

    /// Collect pending transactions with explicit block height for activity modelling.
    pub fn collect_for_block(&mut self, block_height: u64) -> Vec<Transaction> {
        let count = self.target_tx_count(block_height);
        (0..count).map(|_| self.next_tx()).collect()
    }

    // ------------------------------------------------------------------
    // Internal: transaction construction
    // ------------------------------------------------------------------

    fn next_tx(&mut self) -> Transaction {
        self.seq += 1;
        let r = self.rng.f64();
        if r < 0.65 {
            self.tx_data_contribution()
        } else if r < 0.82 {
            self.tx_transfer()
        } else if r < 0.93 {
            self.tx_data_purchase()
        } else {
            self.tx_inference()
        }
    }

    fn pick_device(&mut self) -> (String, &'static str, &'static str) {
        let idx = self.rng.usize(self.devices.len());
        self.devices[idx].clone()
    }

    fn pick_region(&mut self) -> (&'static str, f64, f64) {
        REGIONS[self.rng.usize(REGIONS.len())]
    }

    // ------------------------------------------------------------------
    // Transaction generators
    // ------------------------------------------------------------------

    fn tx_data_contribution(&mut self) -> Transaction {
        let (addr, category, device_class) = self.pick_device();
        let (region, lat, lng) = self.pick_region();

        let telemetry = self.telemetry_for(device_class);
        let data_size = telemetry.len() as u64;
        let quality = self.rng.range_f64(0.65, 1.0);

        let data = format!(
            r#"{{"d":"{}","c":"{}","r":"{}","lat":{:.4},"lng":{:.4},"t":{},"q":{:.3},"sz":{},"ts":{}}}"#,
            &addr[2..10], category, region,
            lat + self.rng.range_f64(-0.05, 0.05),
            lng + self.rng.range_f64(-0.05, 0.05),
            telemetry, quality, data_size, Utc::now().timestamp()
        );

        let reward = (10 + data_size / 10) as f64 * quality;
        let output = TxOutput {
            amount: reward as u64,
            recipient: addr.clone(),
            data_hash: Some(format!("0x{:016x}", self.rng.next_u64())),
        };

        Transaction::new(
            TransactionType::DataContribution,
            addr,
            vec![],
            vec![output],
            Some(data),
            self.rng.range_u64(1, 3),
            21000,
        )
    }

    fn tx_transfer(&mut self) -> Transaction {
        let (src, _, _) = self.pick_device();
        let (mut dst, _, _) = self.pick_device();
        while dst == src { let d = self.pick_device(); dst = d.0; }

        // Realistic amount distribution: many small, few large
        let amt = if self.rng.f64() < 0.7 {
            self.rng.range_u64(1, 100)
        } else if self.rng.f64() < 0.9 {
            self.rng.range_u64(100, 1000)
        } else {
            self.rng.range_u64(1000, 10000)
        };

        let reasons = ["svc_fee", "data_access", "compute", "delegation", "reward_claim", "settlement"];
        let reason = reasons[self.rng.usize(reasons.len())];

        let output = TxOutput {
            amount: amt,
            recipient: dst.clone(),
            data_hash: None,
        };

        let data = format!(
            r#"{{"op":"transfer","to":"{}","amt":{},"ref":"{}","ts":{}}}"#,
            &dst[2..10], amt, reason, Utc::now().timestamp()
        );

        Transaction::new(
            TransactionType::Transfer,
            src,
            vec![],
            vec![output],
            Some(data),
            self.rng.range_u64(1, 5),
            21000,
        )
    }

    fn tx_data_purchase(&mut self) -> Transaction {
        let (buyer, _, _) = self.pick_device();
        let (seller, _, _) = self.pick_device();

        let price = if self.rng.f64() < 0.6 {
            self.rng.range_u64(5, 50)
        } else {
            self.rng.range_u64(50, 500)
        };

        let data_types = [
            "historical_telemetry", "aggregated_metrics", "anomaly_report",
            "ml_dataset", "real_time_feed", "forecast_model",
        ];
        let dtype = data_types[self.rng.usize(data_types.len())];
        let hours = self.rng.range_u64(1, 720);

        let output = TxOutput {
            amount: price,
            recipient: seller.clone(),
            data_hash: Some(format!("0x{:016x}", self.rng.next_u64())),
        };

        let data = format!(
            r#"{{"op":"purchase","seller":"{}","dtype":"{}","price":{},"hours":{},"ts":{}}}"#,
            &seller[2..10], dtype, price, hours, Utc::now().timestamp()
        );

        Transaction::new(
            TransactionType::DataPurchase,
            buyer,
            vec![],
            vec![output],
            Some(data),
            self.rng.range_u64(1, 4),
            30000,
        )
    }

    fn tx_inference(&mut self) -> Transaction {
        let (requester, _, _) = self.pick_device();
        // Pick an EdgeAI node as provider
        let ai_devices: Vec<_> = self.devices.iter()
            .filter(|(_, cat, _)| *cat == "EdgeAI")
            .map(|(a, _, _)| a.clone())
            .collect();
        let provider = if ai_devices.is_empty() {
            self.rng.address()
        } else {
            ai_devices[self.rng.usize(ai_devices.len())].clone()
        };

        let models = [
            ("anomaly_det",  5,  50),
            ("pred_maint",  10, 100),
            ("img_class",   15, 200),
            ("obj_detect",  20, 300),
            ("ts_forecast",  8,  80),
            ("nlp_sent",    12, 150),
        ];
        let (model, base_cost, cu) = models[self.rng.usize(models.len())];
        let cost = base_cost + self.rng.range_u64(0, 15);

        let output = TxOutput {
            amount: cost,
            recipient: provider.clone(),
            data_hash: Some(format!("0x{:016x}", self.rng.next_u64())),
        };

        let data = format!(
            r#"{{"op":"inference","provider":"{}","model":"{}","cu":{},"cost":{},"ts":{}}}"#,
            &provider[2..10], model, cu, cost, Utc::now().timestamp()
        );

        Transaction::new(
            TransactionType::DataPurchase,
            requester,
            vec![],
            vec![output],
            Some(data),
            self.rng.range_u64(2, 5),
            50000,
        )
    }

    // ------------------------------------------------------------------
    // Telemetry generators — produce device-class-specific JSON payloads
    // ------------------------------------------------------------------

    fn telemetry_for(&mut self, device_class: &str) -> String {
        match device_class {
            "traffic_sensor"  => self.telem_traffic(),
            "env_monitor"     => self.telem_air(),
            "street_light"    => self.telem_light(),
            "parking_node"    => self.telem_parking(),
            "acoustic_sensor" => self.telem_noise(),
            "ev_station"      => self.telem_ev(),
            "weather_node" | "flood_gauge" => self.telem_weather(),
            "robotic_arm"     => self.telem_robot(),
            "cnc_unit"        => self.telem_cnc(),
            "vibration_probe" => self.telem_vibration(),
            "pressure_gauge"  => self.telem_pressure(),
            "conveyor_ctrl"   => self.telem_conveyor(),
            "thermal_sensor"  => self.telem_thermal(),
            "vision_qc" | "plc_bridge" => self.telem_industrial_generic(),
            "soil_sensor"     => self.telem_soil(),
            "irrigation_ctrl" => self.telem_irrigation(),
            "survey_uav"      => self.telem_drone(),
            "greenhouse_ctrl" => self.telem_greenhouse(),
            "agri_weather" | "crop_scanner" | "pest_trap" | "livestock_tag" => self.telem_agri_generic(),
            "smart_meter"     => self.telem_meter(),
            "solar_panel"     => self.telem_solar(),
            "wind_unit"       => self.telem_wind(),
            "bess_unit"       => self.telem_battery(),
            "grid_sensor" | "xfmr_monitor" | "pq_analyzer" => self.telem_energy_generic(),
            "patient_hub"     => self.telem_patient(),
            "vent_monitor"    => self.telem_ventilator(),
            "infusion_ctrl" | "ecg_unit" | "blood_analyzer" |
            "imaging_node" | "pharma_dispenser" | "cryo_monitor" => self.telem_health_generic(),
            "fleet_tracker"   => self.telem_gps(),
            "cold_chain_unit" => self.telem_cold_chain(),
            "warehouse_node" | "rfid_gate" | "dock_sensor" |
            "agv_unit" | "inv_scanner" => self.telem_logistics_generic(),
            "gpu_node" | "inference_ep" | "training_worker" |
            "model_registry" | "data_pipeline" => self.telem_compute(),
            _ => self.telem_generic(),
        }
    }

    // Smart City
    fn telem_traffic(&mut self) -> String {
        let v = self.rng.usize(500);
        let p = self.rng.usize(200);
        let c = ["low","med","high","crit"][self.rng.usize(4)];
        let s = self.rng.range_f64(5.0, 80.0);
        format!(r#"{{"v":{},"p":{},"c":"{}","s":{:.1},"i":{}}}"#, v, p, c, s, self.rng.usize(3))
    }

    fn telem_air(&mut self) -> String {
        let aqi = self.rng.usize(300);
        let pm25 = self.rng.range_f64(0.0, 150.0);
        let pm10 = self.rng.range_f64(0.0, 200.0);
        let co2 = self.rng.range_u64(300, 2000);
        format!(r#"{{"aqi":{},"pm25":{:.1},"pm10":{:.1},"co2":{}}}"#, aqi, pm25, pm10, co2)
    }

    fn telem_light(&mut self) -> String {
        let b = self.rng.usize(100);
        let w = self.rng.range_f64(10.0, 150.0);
        let st = ["on","off","dim","auto"][self.rng.usize(4)];
        format!(r#"{{"b":{},"w":{:.1},"st":"{}"}}"#, b, w, st)
    }

    fn telem_parking(&mut self) -> String {
        let occ = self.rng.f64() > 0.3;
        let dur = if occ { self.rng.range_u64(1, 480) } else { 0 };
        format!(r#"{{"occ":{},"dur":{}}}"#, occ, dur)
    }

    fn telem_noise(&mut self) -> String {
        let db = self.rng.range_f64(30.0, 100.0);
        let pk = db + self.rng.range_f64(0.0, 20.0);
        format!(r#"{{"avg":{:.1},"pk":{:.1}}}"#, db, pk)
    }

    fn telem_ev(&mut self) -> String {
        let ch = self.rng.f64() > 0.4;
        let kw = if ch { self.rng.range_f64(3.0, 150.0) } else { 0.0 };
        let soc = self.rng.usize(100);
        format!(r#"{{"ch":{},"kw":{:.1},"soc":{}}}"#, ch, kw, soc)
    }

    fn telem_weather(&mut self) -> String {
        let t = self.rng.range_f64(-10.0, 45.0);
        let h = self.rng.range_f64(20.0, 100.0);
        let p = self.rng.range_f64(980.0, 1040.0);
        format!(r#"{{"t":{:.1},"h":{:.1},"p":{:.1}}}"#, t, h, p)
    }

    // Industrial
    fn telem_robot(&mut self) -> String {
        let cy = self.rng.range_u64(0, 10000);
        let t = self.rng.range_f64(20.0, 80.0);
        let st = ["run","idle","maint","err"][self.rng.usize(4)];
        format!(r#"{{"cy":{},"mt":{:.1},"st":"{}","pr":{:.2}}}"#, cy, t, st, self.rng.range_f64(0.01, 0.5))
    }

    fn telem_cnc(&mut self) -> String {
        let rpm = self.rng.range_u64(0, 15000);
        let fr = self.rng.range_f64(0.0, 500.0);
        format!(r#"{{"rpm":{},"fr":{:.1},"tw":{},"pc":{}}}"#, rpm, fr, self.rng.usize(100), self.rng.range_u64(0, 1000))
    }

    fn telem_vibration(&mut self) -> String {
        let rms = self.rng.range_f64(0.1, 10.0);
        let pk = rms * (1.0 + self.rng.f64());
        let fq = self.rng.range_f64(10.0, 1000.0);
        format!(r#"{{"rms":{:.2},"pk":{:.2},"fq":{:.1},"an":{}}}"#, rms, pk, fq, self.rng.f64() > 0.92)
    }

    fn telem_pressure(&mut self) -> String {
        let p = self.rng.range_f64(0.0, 100.0);
        format!(r#"{{"bar":{:.2},"flow":{:.1},"t":{:.1}}}"#, p, self.rng.range_f64(0.0, 500.0), self.rng.range_f64(10.0, 80.0))
    }

    fn telem_conveyor(&mut self) -> String {
        let sp = self.rng.range_f64(0.0, 5.0);
        let it = self.rng.range_u64(0, 1000);
        format!(r#"{{"sp":{:.2},"it":{},"bt":{:.1}}}"#, sp, it, self.rng.range_f64(20.0, 60.0))
    }

    fn telem_thermal(&mut self) -> String {
        let t = self.rng.range_f64(15.0, 120.0);
        format!(r#"{{"t":{:.1},"al":{}}}"#, t, t > 85.0)
    }

    fn telem_industrial_generic(&mut self) -> String {
        format!(r#"{{"val":{:.2},"st":"{}"}}"#, self.rng.range_f64(0.0, 100.0), ["ok","warn","err"][self.rng.usize(3)])
    }

    // Agriculture
    fn telem_soil(&mut self) -> String {
        let m = self.rng.range_f64(10.0, 80.0);
        let ph = self.rng.range_f64(4.0, 9.0);
        let t = self.rng.range_f64(5.0, 35.0);
        format!(r#"{{"m":{:.1},"ph":{:.1},"t":{:.1},"n":{},"p":{}}}"#, m, ph, t, self.rng.range_u64(0, 200), self.rng.range_u64(0, 100))
    }

    fn telem_irrigation(&mut self) -> String {
        let on = self.rng.f64() > 0.5;
        let fl = if on { self.rng.range_f64(1.0, 50.0) } else { 0.0 };
        format!(r#"{{"on":{},"fl":{:.1},"z":{}}}"#, on, fl, self.rng.usize(10))
    }

    fn telem_drone(&mut self) -> String {
        let alt = self.rng.range_f64(0.0, 120.0);
        let bat = self.rng.usize(100);
        format!(r#"{{"alt":{:.1},"bat":{},"sp":{:.1}}}"#, alt, bat, self.rng.range_f64(0.0, 60.0))
    }

    fn telem_greenhouse(&mut self) -> String {
        let t = self.rng.range_f64(15.0, 35.0);
        let h = self.rng.range_f64(40.0, 90.0);
        let co2 = self.rng.range_u64(400, 1500);
        format!(r#"{{"t":{:.1},"h":{:.1},"co2":{}}}"#, t, h, co2)
    }

    fn telem_agri_generic(&mut self) -> String {
        format!(r#"{{"val":{:.1},"st":"{}"}}"#, self.rng.range_f64(0.0, 100.0), ["ok","warn"][self.rng.usize(2)])
    }

    // Energy
    fn telem_meter(&mut self) -> String {
        let kw = self.rng.range_f64(0.0, 15.0);
        let v = self.rng.range_f64(220.0, 240.0);
        format!(r#"{{"kw":{:.2},"v":{:.1},"a":{:.1},"pf":{:.2}}}"#, kw, v, kw * 1000.0 / v, self.rng.range_f64(0.8, 1.0))
    }

    fn telem_solar(&mut self) -> String {
        let irr = self.rng.range_f64(0.0, 1000.0);
        let pw = irr * 0.2 * self.rng.range_f64(0.8, 1.0) / 1000.0;
        format!(r#"{{"irr":{:.1},"kw":{:.2},"eff":{:.1}}}"#, irr, pw, self.rng.range_f64(15.0, 22.0))
    }

    fn telem_wind(&mut self) -> String {
        let ws = self.rng.range_f64(0.0, 25.0);
        let pw = if ws > 3.0 && ws < 25.0 { (ws.powi(3) * 0.5).min(3000.0) } else { 0.0 };
        format!(r#"{{"ws":{:.1},"kw":{:.1},"rpm":{}}}"#, ws, pw, self.rng.range_u64(0, 20))
    }

    fn telem_battery(&mut self) -> String {
        let soc = self.rng.range_f64(10.0, 100.0);
        let pw = self.rng.range_f64(-100.0, 100.0);
        format!(r#"{{"soc":{:.1},"kw":{:.1},"cy":{}}}"#, soc, pw, self.rng.range_u64(0, 5000))
    }

    fn telem_energy_generic(&mut self) -> String {
        format!(r#"{{"kw":{:.2},"v":{:.1}}}"#, self.rng.range_f64(0.0, 50.0), self.rng.range_f64(200.0, 250.0))
    }

    // Healthcare
    fn telem_patient(&mut self) -> String {
        let hr = self.rng.range_u64(50, 120);
        let spo2 = self.rng.range_u64(90, 100);
        let sys = self.rng.range_u64(90, 160);
        let dia = self.rng.range_u64(60, 100);
        format!(r#"{{"hr":{},"spo2":{},"sys":{},"dia":{},"t":{:.1}}}"#, hr, spo2, sys, dia, self.rng.range_f64(36.0, 38.5))
    }

    fn telem_ventilator(&mut self) -> String {
        let tv = self.rng.range_u64(300, 700);
        let rr = self.rng.range_u64(10, 25);
        let fio2 = self.rng.range_u64(21, 100);
        format!(r#"{{"tv":{},"rr":{},"fio2":{},"peep":{}}}"#, tv, rr, fio2, self.rng.range_u64(5, 15))
    }

    fn telem_health_generic(&mut self) -> String {
        format!(r#"{{"val":{:.1},"st":"{}"}}"#, self.rng.range_f64(0.0, 100.0), ["normal","alert"][self.rng.usize(2)])
    }

    // Logistics
    fn telem_gps(&mut self) -> String {
        let (_, lat, lng) = self.pick_region();
        let sp = self.rng.range_f64(0.0, 120.0);
        format!(r#"{{"lat":{:.6},"lng":{:.6},"sp":{:.1},"hd":{}}}"#,
            lat + self.rng.range_f64(-0.1, 0.1),
            lng + self.rng.range_f64(-0.1, 0.1),
            sp, self.rng.range_u64(0, 360))
    }

    fn telem_cold_chain(&mut self) -> String {
        let t = self.rng.range_f64(-25.0, 8.0);
        let h = self.rng.range_f64(30.0, 90.0);
        format!(r#"{{"t":{:.1},"h":{:.1},"door":{},"comp":{}}}"#, t, h, self.rng.f64() > 0.9, self.rng.f64() > 0.3)
    }

    fn telem_logistics_generic(&mut self) -> String {
        format!(r#"{{"items":{},"st":"{}"}}"#, self.rng.range_u64(0, 5000), ["active","idle"][self.rng.usize(2)])
    }

    // Edge AI
    fn telem_compute(&mut self) -> String {
        let gpu = self.rng.usize(100);
        let gt = self.rng.range_f64(30.0, 85.0);
        let mem = self.rng.range_f64(0.0, 32.0);
        format!(r#"{{"gpu":{},"gt":{:.1},"mem":{:.1},"lat":{:.1},"fps":{:.1}}}"#,
            gpu, gt, mem, self.rng.range_f64(1.0, 100.0), self.rng.range_f64(1.0, 60.0))
    }

    fn telem_generic(&mut self) -> String {
        format!(r#"{{"v":{:.2},"st":"{}"}}"#, self.rng.range_f64(0.0, 100.0), ["ok","warn","err"][self.rng.usize(3)])
    }
}
