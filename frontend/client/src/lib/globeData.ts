// Shared globe markers data for Dashboard and Validators pages
// Includes major cities and distributed edge nodes for a dense, active network visualization

export interface GlobeMarker {
  location: [number, number];
  size: number;
  tooltip: string;
  type?: 'hub' | 'node';
  pulse?: boolean;
}

export const GLOBE_MARKERS: GlobeMarker[] = [
  // --- Major Hubs (Larger, brighter) ---
  { location: [40.7128, -74.0060], size: 0.08, tooltip: "New York Hub", type: 'hub' },
  { location: [51.5074, -0.1278], size: 0.08, tooltip: "London Hub", type: 'hub' },
  { location: [35.6762, 139.6503], size: 0.08, tooltip: "Tokyo Hub", type: 'hub' },
  { location: [1.3521, 103.8198], size: 0.08, tooltip: "Singapore Hub", type: 'hub' },
  { location: [52.5200, 13.4050], size: 0.08, tooltip: "Berlin Hub", type: 'hub' },
  { location: [31.2304, 121.4737], size: 0.08, tooltip: "Shanghai Hub", type: 'hub' },
  { location: [-33.8688, 151.2093], size: 0.08, tooltip: "Sydney Hub", type: 'hub' },
  { location: [43.6532, -79.3832], size: 0.08, tooltip: "Toronto Hub", type: 'hub' },
  { location: [48.8566, 2.3522], size: 0.08, tooltip: "Paris Hub", type: 'hub' },
  { location: [37.5665, 126.9780], size: 0.08, tooltip: "Seoul Hub", type: 'hub' },
  { location: [19.0760, 72.8777], size: 0.08, tooltip: "Mumbai Hub", type: 'hub' },
  { location: [-23.5505, -46.6333], size: 0.08, tooltip: "Sao Paulo Hub", type: 'hub' },
  { location: [25.2048, 55.2708], size: 0.08, tooltip: "Dubai Hub", type: 'hub' },
  { location: [52.3676, 4.9041], size: 0.08, tooltip: "Amsterdam Hub", type: 'hub' },
  { location: [59.3293, 18.0686], size: 0.08, tooltip: "Stockholm Hub", type: 'hub' },
  { location: [37.7749, -122.4194], size: 0.08, tooltip: "San Francisco Hub", type: 'hub' },
  { location: [55.7558, 37.6173], size: 0.08, tooltip: "Moscow Hub", type: 'hub' },
  { location: [-33.9249, 18.4241], size: 0.08, tooltip: "Cape Town Hub", type: 'hub' },

  // --- Regional Nodes (Standard size) ---
  // North America
  { location: [34.0522, -118.2437], size: 0.05, tooltip: "Los Angeles Node" },
  { location: [41.8781, -87.6298], size: 0.05, tooltip: "Chicago Node" },
  { location: [25.7617, -80.1918], size: 0.05, tooltip: "Miami Node" },
  { location: [19.4326, -99.1332], size: 0.05, tooltip: "Mexico City Node" },
  { location: [47.6062, -122.3321], size: 0.05, tooltip: "Seattle Node" },
  { location: [39.7392, -104.9903], size: 0.05, tooltip: "Denver Node" },
  { location: [33.7490, -84.3880], size: 0.05, tooltip: "Atlanta Node" },
  { location: [42.3601, -71.0589], size: 0.05, tooltip: "Boston Node" },
  { location: [45.5017, -73.5673], size: 0.05, tooltip: "Montreal Node" },
  { location: [49.2827, -123.1207], size: 0.05, tooltip: "Vancouver Node" },

  // South America
  { location: [-34.6037, -58.3816], size: 0.05, tooltip: "Buenos Aires Node" },
  { location: [-4.4441, -62.9258], size: 0.05, tooltip: "Amazonas Edge Node" },
  { location: [-33.4489, -70.6693], size: 0.05, tooltip: "Santiago Node" },
  { location: [4.7110, -74.0721], size: 0.05, tooltip: "Bogota Node" },
  { location: [-12.0464, -77.0428], size: 0.05, tooltip: "Lima Node" },
  { location: [-0.1807, -78.4678], size: 0.05, tooltip: "Quito Node" },

  // Europe
  { location: [41.9028, 12.4964], size: 0.05, tooltip: "Rome Node" },
  { location: [40.4168, -3.7038], size: 0.05, tooltip: "Madrid Node" },
  { location: [48.1351, 11.5820], size: 0.05, tooltip: "Munich Node" },
  { location: [50.1109, 8.6821], size: 0.05, tooltip: "Frankfurt Node" },
  { location: [47.3769, 8.5417], size: 0.05, tooltip: "Zurich Node" },
  { location: [52.2297, 21.0122], size: 0.05, tooltip: "Warsaw Node" },
  { location: [48.2082, 16.3738], size: 0.05, tooltip: "Vienna Node" },
  { location: [59.9139, 10.7522], size: 0.05, tooltip: "Oslo Node" },
  { location: [60.1699, 24.9384], size: 0.05, tooltip: "Helsinki Node" },
  { location: [37.9838, 23.7275], size: 0.05, tooltip: "Athens Node" },
  { location: [38.7223, -9.1393], size: 0.05, tooltip: "Lisbon Node" },

  // Africa
  { location: [6.5244, 3.3792], size: 0.05, tooltip: "Lagos Node" },
  { location: [30.0444, 31.2357], size: 0.05, tooltip: "Cairo Node" },
  { location: [-1.2921, 36.8219], size: 0.05, tooltip: "Nairobi Node" },
  { location: [5.6037, -0.1870], size: 0.05, tooltip: "Accra Node" },
  { location: [9.0820, 8.6753], size: 0.05, tooltip: "Nigeria Edge Node" },
  { location: [-26.2041, 28.0473], size: 0.05, tooltip: "Johannesburg Node" },
  { location: [34.0133, -6.8326], size: 0.05, tooltip: "Rabat Node" },

  // Asia & Middle East
  { location: [13.7563, 100.5018], size: 0.05, tooltip: "Bangkok Node" },
  { location: [-6.2088, 106.8456], size: 0.05, tooltip: "Jakarta Node" },
  { location: [22.3193, 114.1694], size: 0.05, tooltip: "Hong Kong Node" },
  { location: [28.6139, 77.2090], size: 0.05, tooltip: "New Delhi Node" },
  { location: [12.9716, 77.5946], size: 0.05, tooltip: "Bangalore Node" },
  { location: [10.8231, 106.6297], size: 0.05, tooltip: "Ho Chi Minh City Node" },
  { location: [14.5995, 120.9842], size: 0.05, tooltip: "Manila Node" },
  { location: [3.1390, 101.6869], size: 0.05, tooltip: "Kuala Lumpur Node" },
  { location: [24.7136, 46.6753], size: 0.05, tooltip: "Riyadh Node" },
  { location: [32.0853, 34.7818], size: 0.05, tooltip: "Tel Aviv Node" },
  { location: [39.9042, 116.4074], size: 0.05, tooltip: "Beijing Node" },
  { location: [25.0330, 121.5654], size: 0.05, tooltip: "Taipei Node" },

  // Oceania
  { location: [-37.8136, 144.9631], size: 0.05, tooltip: "Melbourne Node" },
  { location: [-41.2865, 174.7762], size: 0.05, tooltip: "Wellington Node" },
  { location: [-31.9505, 115.8605], size: 0.05, tooltip: "Perth Node" },
  { location: [-36.8485, 174.7633], size: 0.05, tooltip: "Auckland Node" },
];

// Generate additional random nodes around major hubs to increase density
const generateDenseNodes = (count: number): GlobeMarker[] => {
  const nodes: GlobeMarker[] = [];
  const hubs = GLOBE_MARKERS.filter(m => m.type === 'hub');
  
  for (let i = 0; i < count; i++) {
    const hub = hubs[Math.floor(Math.random() * hubs.length)];
    // Random scatter around hub (within ~500km)
    const latScatter = (Math.random() - 0.5) * 10;
    const lngScatter = (Math.random() - 0.5) * 10;
    
    nodes.push({
      location: [
        Math.max(-90, Math.min(90, hub.location[0] + latScatter)),
        hub.location[1] + lngScatter
      ],
      size: 0.02 + Math.random() * 0.02, // Smaller, variable size
      tooltip: `Edge Node #${Math.floor(Math.random() * 10000)}`,
      type: 'node'
    });
  }
  return nodes;
};

// Export combined list with extra density
export const ALL_GLOBE_MARKERS = [
  ...GLOBE_MARKERS,
  ...generateDenseNodes(150) // Add 150 extra scattered nodes
];
