import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Activity, Server, Signal, Map as MapIcon } from "lucide-react";
import { Globe3D } from "@/components/Globe3D";
import { ALL_GLOBE_MARKERS } from "@/lib/globeData";
import { cn } from "@/lib/utils";
import { fetchValidatorNodes, ValidatorStats } from "@/lib/api";
import { Validator } from "@/lib/validators";

export default function Validators() {
  const [validators, setValidators] = useState<Validator[]>([]);
  const [stats, setStats] = useState<ValidatorStats>({ online: 0, offline: 0, maintenance: 0 });
  const [totalValidators, setTotalValidators] = useState(0);
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
    // Fetch validator data from backend API
    const loadValidators = async () => {
      setLoading(true);
      try {
        const response = await fetchValidatorNodes(currentPage, itemsPerPage);
        setValidators(response.validators);
        setStats(response.stats);
        setTotalValidators(response.total);
      } catch (error) {
        console.error("Failed to load validators:", error);
      } finally {
        setLoading(false);
      }
    };

    loadValidators();
  }, [currentPage]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'maintenance': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'offline': return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  // Calculate network metrics
  const onlineCount = stats.online;
  const onlineRate = totalValidators > 0 ? (onlineCount / totalValidators) * 100 : 0;
  const totalBlocks = validators.reduce((acc, v) => acc + v.blocks_mined, 0);
  
  // Calculate regional distribution from current page
  const regionStats = validators.reduce((acc, v) => {
    acc[v.location] = (acc[v.location] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const topRegions = Object.entries(regionStats)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4);

  const totalPages = Math.ceil(totalValidators / itemsPerPage);

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
              {onlineCount.toLocaleString()} / {totalValidators.toLocaleString()} nodes online
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
              Based on {totalBlocks.toLocaleString()} blocks mined (current page)
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-muted">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Node Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-green-500">Online</span>
                <div className="flex items-center gap-2 w-1/2">
                  <div className="h-1.5 flex-1 bg-secondary rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-green-500" 
                      style={{ width: `${totalValidators > 0 ? (stats.online / totalValidators) * 100 : 0}%` }}
                    ></div>
                  </div>
                  <span className="w-16 text-right">{stats.online.toLocaleString()}</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-yellow-500">Maintenance</span>
                <div className="flex items-center gap-2 w-1/2">
                  <div className="h-1.5 flex-1 bg-secondary rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-yellow-500" 
                      style={{ width: `${totalValidators > 0 ? (stats.maintenance / totalValidators) * 100 : 0}%` }}
                    ></div>
                  </div>
                  <span className="w-16 text-right">{stats.maintenance.toLocaleString()}</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-red-500">Offline</span>
                <div className="flex items-center gap-2 w-1/2">
                  <div className="h-1.5 flex-1 bg-secondary rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-red-500" 
                      style={{ width: `${totalValidators > 0 ? (stats.offline / totalValidators) * 100 : 0}%` }}
                    ></div>
                  </div>
                  <span className="w-16 text-right">{stats.offline.toLocaleString()}</span>
                </div>
              </div>
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
                ) : validators.map((validator, index) => (
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
          {!loading && totalValidators > 0 && (
            <div className="flex items-center justify-between px-4 py-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to{" "}
                <span className="font-medium">{Math.min(currentPage * itemsPerPage, totalValidators)}</span> of{" "}
                <span className="font-medium">{totalValidators.toLocaleString()}</span> results
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
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
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
