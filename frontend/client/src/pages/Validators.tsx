import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Activity, Server, Signal, Map as MapIcon } from "lucide-react";
import { Globe3D } from "@/components/Globe3D";
import { ALL_GLOBE_MARKERS } from "@/lib/globeData";
import { cn } from "@/lib/utils";
import { TOTAL_VALIDATOR_COUNT } from "@/lib/validators";

interface Validator {
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

export default function Validators() {
  const [validators, setValidators] = useState<Validator[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Define major city connections for "flying lines"
  const connections = [
    // Connect major hubs to form a global network mesh
    // NY -> London
    { start: [40.7128, -74.0060], end: [51.5074, -0.1278] },
    // London -> Frankfurt
    { start: [51.5074, -0.1278], end: [50.1109, 8.6821] },
    // Frankfurt -> Singapore
    { start: [50.1109, 8.6821], end: [1.3521, 103.8198] },
    // Singapore -> Tokyo
    { start: [1.3521, 103.8198], end: [35.6762, 139.6503] },
    // Tokyo -> San Francisco
    { start: [35.6762, 139.6503], end: [37.7749, -122.4194] },
    // San Francisco -> NY
    { start: [37.7749, -122.4194], end: [40.7128, -74.0060] },
    // London -> Singapore (Direct)
    { start: [51.5074, -0.1278], end: [1.3521, 103.8198] },
    // NY -> Sao Paulo
    { start: [40.7128, -74.0060], end: [-23.5505, -46.6333] },
    // Sao Paulo -> London
    { start: [-23.5505, -46.6333], end: [51.5074, -0.1278] },
    // Sydney -> Singapore
    { start: [-33.8688, 151.2093], end: [1.3521, 103.8198] },
    // Sydney -> San Francisco
    { start: [-33.8688, 151.2093], end: [37.7749, -122.4194] },
  ] as { start: [number, number]; end: [number, number] }[];

  useEffect(() => {
    // Simulate fetching validator data
    const generateValidators = () => {
      const nodes: Validator[] = [];
      // Expanded list of major tech hubs and cities to ensure nodes appear on land
      const locations = [
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
      
      // Generate nodes using shared constant
      const totalNodes = TOTAL_VALIDATOR_COUNT;
      
      for (let i = 1; i <= totalNodes; i++) {
        const id = i.toString().padStart(5, '0');
        // Bias towards online status for a healthy network demo
        const statusRandom = Math.random();
        let status: 'online' | 'offline' | 'maintenance' = 'online';
        if (statusRandom > 0.98) status = 'offline';
        else if (statusRandom > 0.95) status = 'maintenance';

        const loc = locations[Math.floor(Math.random() * locations.length)];
        
        // Significantly reduced jitter to keep nodes clustered around cities (land)
        // +/- 1.5 degrees is roughly +/- 150km, keeping nodes within metro/regional areas
        // Use a gaussian-like distribution (sum of randoms) to cluster tightly near center
        const latJitter = ((Math.random() + Math.random() + Math.random()) / 3 - 0.5) * 3; 
        const lngJitter = ((Math.random() + Math.random() + Math.random()) / 3 - 0.5) * 3;
        
        const lat = Math.max(-90, Math.min(90, loc.lat + latJitter));
        const lng = loc.lng + lngJitter;

        nodes.push({
          id: `val_${id}`,
          name: `edge_node_${id}`,
          status,
          blocks_mined: Math.floor(Math.random() * 5000) + 10,
          reputation: 85 + Math.random() * 15, 
          uptime: 95 + Math.random() * 5,
          location: loc.name,
          lat,
          lng
        });
      }
      
      // Sort by blocks mined (descending) to show top performers first
      return nodes.sort((a, b) => b.blocks_mined - a.blocks_mined);
    };

    // Simulate network delay
    setTimeout(() => {
      setValidators(generateValidators());
      setLoading(false);
    }, 1500);
  }, []);

  const paginatedValidators = validators.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'maintenance': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'offline': return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  // Calculate network metrics
  const onlineCount = validators.filter(v => v.status === 'online').length;
  const onlineRate = validators.length > 0 ? (onlineCount / validators.length) * 100 : 0;
  const totalBlocks = validators.reduce((acc, v) => acc + v.blocks_mined, 0);
  
  // Calculate regional distribution
  const regionStats = validators.reduce((acc, v) => {
    acc[v.location] = (acc[v.location] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const topRegions = Object.entries(regionStats)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-8 w-8 text-primary" />
            Validators
          </h1>
          <p className="text-muted-foreground mt-1">
            Network consensus participants and edge node status.
          </p>
        </div>
      </div>

      {/* Network Health Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-card/50 border-muted">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Network Uptime</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{onlineRate.toFixed(2)}%</div>
            <div className="mt-2 h-2 w-full bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-green-500" style={{ width: `${onlineRate}%` }}></div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {onlineCount.toLocaleString()} / {validators.length.toLocaleString()} nodes online
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-muted">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Network Hashrate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(totalBlocks / 1000000).toFixed(2)} EH/s</div>
            <div className="flex items-center gap-2 mt-2 text-xs text-green-500">
              <Activity className="h-3 w-3" />
              <span>+12.5% from last epoch</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Based on {totalBlocks.toLocaleString()} blocks mined
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-muted">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Regional Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topRegions.map(([region, count], i) => (
                <div key={region} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{region}</span>
                  <div className="flex items-center gap-2 w-1/2">
                    <div className="h-1.5 flex-1 bg-secondary rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary" 
                        style={{ width: `${(count / validators.length) * 100}%` }}
                      ></div>
                    </div>
                    <span className="w-8 text-right">{((count / validators.length) * 100).toFixed(1)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Global Node Map */}
      <Card className="overflow-hidden border-border/50 bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MapIcon className="h-5 w-5 text-primary" />
            Global Node Distribution
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-[500px] w-full relative flex items-center justify-center overflow-hidden">
            {!loading && (
              <Globe3D 
                className="h-full w-full"
                markers={ALL_GLOBE_MARKERS}
                connections={connections}
                scale={1.1}
                sizingMode="fit"
              />
            )}
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active Edge Nodes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative w-full overflow-auto">
            <table className="w-full caption-bottom text-sm">
              <thead className="[&_tr]:border-b">
                <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Rank</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Node Name</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Status</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Location</th>
                  <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Blocks Mined</th>
                  <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Uptime</th>
                  <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Reputation</th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {loading ? (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Loading validator network data...</td></tr>
                ) : paginatedValidators.map((validator, index) => (
                  <tr key={validator.id} className="border-b transition-colors hover:bg-muted/50">
                    <td className="p-4 align-middle font-medium text-muted-foreground">#{(currentPage - 1) * itemsPerPage + index + 1}</td>
                    <td className="p-4 align-middle font-medium flex items-center gap-2">
                      <Server className="h-4 w-4 text-muted-foreground" />
                      {validator.name}
                    </td>
                    <td className="p-4 align-middle">
                      <Badge variant="outline" className={getStatusColor(validator.status)}>
                        {validator.status.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="p-4 align-middle text-muted-foreground">{validator.location}</td>
                    <td className="p-4 align-middle text-right font-mono">{validator.blocks_mined.toLocaleString()}</td>
                    <td className="p-4 align-middle text-right font-mono text-green-500">{validator.uptime.toFixed(2)}%</td>
                    <td className="p-4 align-middle text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-2 bg-secondary rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary" 
                            style={{ width: `${validator.reputation}%` }}
                          ></div>
                        </div>
                        <span className="font-mono text-xs">{validator.reputation.toFixed(1)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          {!loading && validators.length > 0 && (
            <div className="flex items-center justify-between px-4 py-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to{" "}
                <span className="font-medium">{Math.min(currentPage * itemsPerPage, validators.length)}</span> of{" "}
                <span className="font-medium">{validators.length.toLocaleString()}</span> results
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm border rounded hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil(validators.length / itemsPerPage), p + 1))}
                  disabled={currentPage >= Math.ceil(validators.length / itemsPerPage)}
                  className="px-3 py-1 text-sm border rounded hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
