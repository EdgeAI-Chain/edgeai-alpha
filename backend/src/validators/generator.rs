use std::collections::HashMap;
use crate::validators::types::{
    ValidatorNode, ValidatorStatus, ValidatorLocation, ValidatorStats,
    GlobeMarker, ValidatorMapResponse,
};

/// 确定性随机数生成器（正弦方法）
pub struct SeededRandom {
    seed: u64,
}

impl SeededRandom {
    pub fn new(seed: u64) -> Self {
        SeededRandom { seed }
    }

    pub fn next(&mut self) -> f64 {
        self.seed = self.seed.wrapping_add(1);
        let x = (self.seed as f64).sin() * 10000.0;
        x - x.floor()
    }

    pub fn next_int(&mut self, max: usize) -> usize {
        (self.next() * max as f64) as usize
    }
}

/// 验证者生成器
pub struct ValidatorGenerator {
    locations: Vec<ValidatorLocation>,
    total_count: u64,
}

impl ValidatorGenerator {
    pub fn new() -> Self {
        ValidatorGenerator {
            locations: ValidatorLocation::all(),
            total_count: 30000,
        }
    }

    pub fn with_count(count: u64) -> Self {
        ValidatorGenerator {
            locations: ValidatorLocation::all(),
            total_count: count,
        }
    }

    /// 生成单个验证者
    pub fn generate_validator(&self, index: u64) -> ValidatorNode {
        let mut rng = SeededRandom::new(12345 + index);

        // 生成 ID
        let id = format!("val_{:05}", index + 1);
        let name = format!("edge_node_{:05}", index + 1);

        // 生成状态（偏向在线）
        let status_random = rng.next();
        let status = if status_random > 0.98 {
            ValidatorStatus::Offline
        } else if status_random > 0.95 {
            ValidatorStatus::Maintenance
        } else {
            ValidatorStatus::Online
        };

        // 选择位置
        let loc_index = rng.next_int(self.locations.len());
        let loc = &self.locations[loc_index];

        // 添加位置抖动（保持在城市附近）
        let lat_jitter = (rng.next() + rng.next() + rng.next()) / 3.0 - 0.5;
        let lng_jitter = (rng.next() + rng.next() + rng.next()) / 3.0 - 0.5;
        let lat_jitter = lat_jitter * 3.0;
        let lng_jitter = lng_jitter * 3.0;

        let lat = (loc.lat + lat_jitter).max(-90.0).min(90.0);
        let lng = loc.lng + lng_jitter;

        // 生成统计数据
        let blocks_mined = (rng.next() * 5000.0) as u64 + 10;
        let reputation = 85.0 + rng.next() * 15.0;
        let uptime = 95.0 + rng.next() * 5.0;

        ValidatorNode {
            id,
            name,
            status,
            blocks_mined,
            reputation,
            uptime,
            location: loc.name.to_string(),
            lat,
            lng,
        }
    }

    /// 生成验证者列表（分页）
    pub fn generate_validators(&self, page: u64, limit: u64) -> Vec<ValidatorNode> {
        let start = (page - 1) * limit;
        let end = (start + limit).min(self.total_count);

        // 生成所有验证者并排序
        let mut validators: Vec<ValidatorNode> = (0..self.total_count)
            .map(|i| self.generate_validator(i))
            .collect();

        // 按 blocks_mined 降序排序
        validators.sort_by(|a, b| b.blocks_mined.cmp(&a.blocks_mined));

        // 返回分页结果
        validators
            .into_iter()
            .skip(start as usize)
            .take((end - start) as usize)
            .collect()
    }

    /// 获取验证者统计信息
    pub fn get_stats(&self) -> ValidatorStats {
        let mut online = 0u64;
        let mut offline = 0u64;
        let mut maintenance = 0u64;

        for i in 0..self.total_count {
            let validator = self.generate_validator(i);
            match validator.status {
                ValidatorStatus::Online => online += 1,
                ValidatorStatus::Offline => offline += 1,
                ValidatorStatus::Maintenance => maintenance += 1,
            }
        }

        ValidatorStats {
            online,
            offline,
            maintenance,
        }
    }

    /// 生成地图标记（聚合）
    pub fn generate_map_markers(&self) -> ValidatorMapResponse {
        let mut location_counts: HashMap<String, (ValidatorLocation, u64)> = HashMap::new();

        // 统计每个位置的验证者数量
        for i in 0..self.total_count {
            let mut rng = SeededRandom::new(12345 + i);
            let loc_index = rng.next_int(self.locations.len());
            let loc = &self.locations[loc_index];

            location_counts
                .entry(loc.name.to_string())
                .and_modify(|(_, count)| *count += 1)
                .or_insert((loc.clone(), 1));
        }

        // 生成标记
        let markers: Vec<GlobeMarker> = location_counts
            .into_iter()
            .map(|(name, (loc, count))| {
                // 根据验证者数量调整大小
                let size = 0.03 + (count as f64 / self.total_count as f64) * 0.15;
                
                GlobeMarker {
                    location: (loc.lat, loc.lng),
                    size,
                    tooltip: format!("{} ({} nodes)", name, count),
                    marker_type: if count > 1000 { "hub".to_string() } else { "node".to_string() },
                    validator_count: count,
                }
            })
            .collect();

        ValidatorMapResponse {
            markers,
            total_validators: self.total_count,
        }
    }

    pub fn total_count(&self) -> u64 {
        self.total_count
    }
}

impl Default for ValidatorGenerator {
    fn default() -> Self {
        Self::new()
    }
}

impl Clone for ValidatorLocation {
    fn clone(&self) -> Self {
        ValidatorLocation {
            name: self.name,
            lat: self.lat,
            lng: self.lng,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_validator() {
        let generator = ValidatorGenerator::new();
        let validator = generator.generate_validator(0);

        assert_eq!(validator.id, "val_00001");
        assert!(!validator.location.is_empty());
    }

    #[test]
    fn test_deterministic_generation() {
        let generator = ValidatorGenerator::new();
        let v1 = generator.generate_validator(42);
        let v2 = generator.generate_validator(42);

        assert_eq!(v1.id, v2.id);
        assert_eq!(v1.blocks_mined, v2.blocks_mined);
        assert_eq!(v1.location, v2.location);
    }

    #[test]
    fn test_map_markers() {
        let generator = ValidatorGenerator::with_count(100);
        let map = generator.generate_map_markers();

        assert!(!map.markers.is_empty());
        assert_eq!(map.total_validators, 100);
    }
}
