// Shared validator data source to ensure consistency across pages

export interface Validator {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'maintenance';
  blocks_mined: number;
  reputation: number;
  uptime: number;
  location: string;
  lat: number;
  lng: number;
}

// Major tech hubs and cities for node clustering
export const VALIDATOR_LOCATIONS = [
  // North America
  { name: 'US-East (N. Virginia)', lat: 39.0438, lng: -77.4874 },
  { name: 'US-East (New York)', lat: 40.7128, lng: -74.0060 },
  { name: 'US-West (California)', lat: 37.3382, lng: -121.8863 },
  { name: 'US-West (Oregon)', lat: 45.5152, lng: -122.6784 },
  { name: 'US-Central (Texas)', lat: 30.2672, lng: -97.7431 },
  { name: 'Canada (Toronto)', lat: 43.6532, lng: -79.3832 },
  { name: 'Canada (Montreal)', lat: 45.5017, lng: -73.5673 },
  
  // Europe
  { name: 'EU-Central (Frankfurt)', lat: 50.1109, lng: 8.6821 },
  { name: 'EU-West (London)', lat: 51.5074, lng: -0.1278 },
  { name: 'EU-West (Paris)', lat: 48.8566, lng: 2.3522 },
  { name: 'EU-North (Stockholm)', lat: 59.3293, lng: 18.0686 },
  { name: 'EU-West (Ireland)', lat: 53.3498, lng: -6.2603 },
  { name: 'EU-South (Milan)', lat: 45.4642, lng: 9.1900 },
  
  // Asia Pacific
  { name: 'Asia-East (Tokyo)', lat: 35.6762, lng: 139.6503 },
  { name: 'Asia-East (Seoul)', lat: 37.5665, lng: 126.9780 },
  { name: 'Asia-East (Hong Kong)', lat: 22.3193, lng: 114.1694 },
  { name: 'Asia-South (Singapore)', lat: 1.3521, lng: 103.8198 },
  { name: 'Asia-South (Mumbai)', lat: 19.0760, lng: 72.8777 },
  { name: 'AU-East (Sydney)', lat: -33.8688, lng: 151.2093 },
  { name: 'AU-South (Melbourne)', lat: -37.8136, lng: 144.9631 },
  
  // South America
  { name: 'SA-East (Sao Paulo)', lat: -23.5505, lng: -46.6333 },
  { name: 'SA-West (Santiago)', lat: -33.4489, lng: -70.6693 },
  
  // Middle East & Africa
  { name: 'ME-Central (Dubai)', lat: 25.2048, lng: 55.2708 },
  { name: 'AF-South (Cape Town)', lat: -33.9249, lng: 18.4241 }
];

// Deterministic random number generator for consistent data
class SeededRandom {
  private seed: number;
  constructor(seed: number) {
    this.seed = seed;
  }
  
  next() {
    const x = Math.sin(this.seed++) * 10000;
    return x - Math.floor(x);
  }
}

export const TOTAL_VALIDATOR_COUNT = 30000;

// Generate a consistent list of validators
export const generateValidators = (count: number = TOTAL_VALIDATOR_COUNT): Validator[] => {
  const nodes: Validator[] = [];
  const rng = new SeededRandom(12345); // Fixed seed for consistency
  
  for (let i = 1; i <= count; i++) {
    const id = i.toString().padStart(5, '0');
    // Bias towards online status for a healthy network demo
    const statusRandom = rng.next();
    let status: 'online' | 'offline' | 'maintenance' = 'online';
    if (statusRandom > 0.98) status = 'offline';
    else if (statusRandom > 0.95) status = 'maintenance';

    const loc = VALIDATOR_LOCATIONS[Math.floor(rng.next() * VALIDATOR_LOCATIONS.length)];
    
    // Significantly reduced jitter to keep nodes clustered around cities (land)
    const latJitter = ((rng.next() + rng.next() + rng.next()) / 3 - 0.5) * 3; 
    const lngJitter = ((rng.next() + rng.next() + rng.next()) / 3 - 0.5) * 3;
    
    const lat = Math.max(-90, Math.min(90, loc.lat + latJitter));
    const lng = loc.lng + lngJitter;

    nodes.push({
      id: `val_${id}`,
      name: `edge_node_${id}`,
      status,
      blocks_mined: Math.floor(rng.next() * 5000) + 10,
      reputation: 85 + rng.next() * 15, 
      uptime: 95 + rng.next() * 5,
      location: loc.name,
      lat,
      lng
    });
  }
  
  // Sort by blocks mined (descending) to show top performers first
  return nodes.sort((a, b) => b.blocks_mined - a.blocks_mined);
};

// Singleton instance of validators to be shared
let cachedValidators: Validator[] | null = null;

export const getValidators = (): Validator[] => {
  if (!cachedValidators) {
    cachedValidators = generateValidators();
  }
  return cachedValidators;
};

// Get a random active validator (weighted by blocks mined)
export const getRandomActiveValidator = (): Validator => {
  const validators = getValidators();
  // Prefer top 100 validators for blocks
  const topValidators = validators.slice(0, 100);
  return topValidators[Math.floor(Math.random() * topValidators.length)];
};
