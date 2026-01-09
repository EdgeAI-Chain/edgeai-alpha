import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiCall, Block, Transaction, fetchChainStats, fetchIoTTransactions, ChainStats } from "@/lib/api";
import { useSmartPolling } from "@/hooks/useSmartPolling";
import { Link, useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import QRCode from "react-qr-code";
import { Search, RefreshCw, Layers, Activity, Hash, Database, Clock, BarChart, Cpu, Monitor, Maximize2, Minimize2, Building2, Factory, Leaf, HeartPulse, Truck, Zap, ArrowRightLeft, Copy, CheckCircle2, XCircle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Globe3D } from "@/components/Globe3D";
import { ALL_GLOBE_MARKERS } from "@/lib/globeData";
import { useTransactionSimulator } from "@/hooks/useTransactionSimulator";
import { TOTAL_VALIDATOR_COUNT } from "@/lib/validators";

export default function Dashboard() {
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [stats, setStats] = useState({
    height: 0,
    txCount: 0,
    accountCount: 0,
    difficulty: 0,
    avgBlockTime: 0,
    avgTxPerBlock: 0,
    // PoIE Network Metrics from backend
    networkEntropy: 0,
    dataThroughput: 0,
    tps: 0,
    validatorPower: 0
  });
  const [latestBlocks, setLatestBlocks] = useState<Block[]>([]);
  const [recentActivity, setRecentActivity] = useState<Transaction[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [, setLocation] = useLocation();
  const [heatmapPoints, setHeatmapPoints] = useState<{lat: number, lon: number, value: number}[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  
  // Use transaction simulator for globe visualization only
  const { markers: globeMarkers, activeTransactions: simulatedTxs } = useTransactionSimulator(true);

  // Fetch all data from backend
  const fetchData = useCallback(async () => {
    const now = new Date();
    setLastUpdated(now.toLocaleTimeString());

    // Fetch chain stats from backend
    try {
      const chainStats = await fetchChainStats();
      setStats(prev => ({
        ...prev,
        height: chainStats.height,
        txCount: chainStats.total_transactions,
        accountCount: chainStats.active_accounts,
        difficulty: chainStats.difficulty,
        avgTxPerBlock: chainStats.avg_tx_per_block || 0,
        networkEntropy: chainStats.network_entropy || 0,
        dataThroughput: chainStats.data_throughput || 0,
        tps: chainStats.tps || 0,
        validatorPower: chainStats.validator_power || 0,
      }));
    } catch (error) {
      console.error("Failed to fetch chain stats:", error);
    }

    // Fetch blocks from backend
    const blocksRes = await apiCall<Block[]>('/blocks?limit=20');
    
    if (!blocksRes.success) {
      throw new Error(blocksRes.error || "Failed to fetch blocks");
    }

    if (Array.isArray(blocksRes.data)) {
      const blocks = blocksRes.data;
      
      // Use backend blocks directly - no simulation override
      setLatestBlocks(blocks.slice(0, 10));
      
      if (blocks.length > 0) {
        // Calculate metrics and prepare chart data
        let totalTimeDiff = 0;
        let validDiffs = 0;
        let totalTx = 0;
        const newChartData = [];

        // Process blocks in reverse order (oldest to newest) for the chart
        const sortedBlocks = [...blocks].reverse();

        for (let i = 0; i < sortedBlocks.length; i++) {
          const block = sortedBlocks[i];
          const txCount = block.transactions.length;
          let blockTime = 0;

          // Calculate block time relative to previous block (if available)
          if (i > 0) {
            // Get timestamp from nested header or flat structure
            let t1: number;
            if (block.header?.timestamp) {
              t1 = new Date(block.header.timestamp).getTime();
            } else if (block.timestamp !== undefined) {
              t1 = typeof block.timestamp === 'number' && block.timestamp < 10000000000 
                ? block.timestamp * 1000 
                : (typeof block.timestamp === 'string' ? new Date(block.timestamp).getTime() : block.timestamp);
            } else {
              t1 = Date.now();
            }
              
            const prevBlock = sortedBlocks[i-1];
            let t2: number;
            if (prevBlock.header?.timestamp) {
              t2 = new Date(prevBlock.header.timestamp).getTime();
            } else if (prevBlock.timestamp !== undefined) {
              t2 = typeof prevBlock.timestamp === 'number' && prevBlock.timestamp < 10000000000 
                ? prevBlock.timestamp * 1000 
                : (typeof prevBlock.timestamp === 'string' ? new Date(prevBlock.timestamp).getTime() : prevBlock.timestamp);
            } else {
              t2 = Date.now();
            }
            
            const diff = (t1 - t2) / 1000; // seconds
            if (diff > 0 && diff < 3600) {
              blockTime = diff;
              totalTimeDiff += diff;
              validDiffs++;
            }
          }

          totalTx += txCount;
          
          // Estimate hashrate based on difficulty and block time
          const difficulty = block.header?.difficulty || block.difficulty || 2;
          const estimatedHashrate = blockTime > 0 ? (difficulty / blockTime) * 100 : 0;

          newChartData.push({
            height: block.index,
            txCount: txCount,
            blockTime: blockTime > 0 ? blockTime : null,
            hashrate: estimatedHashrate > 0 ? estimatedHashrate : null
          });
        }

        const avgTime = validDiffs > 0 ? totalTimeDiff / validDiffs : 10;
        const avgTx = totalTx / blocks.length;

        setStats(prev => ({ 
          ...prev, 
          avgBlockTime: parseFloat(avgTime.toFixed(1)),
          avgTxPerBlock: parseFloat(avgTx.toFixed(1))
        }));
        
        setChartData(newChartData);
      }
    }

    // Fetch IoT transactions from backend
    try {
      const iotData = await fetchIoTTransactions(1, 9);
      const mappedTxs = iotData.transactions.map(tx => ({
        id: tx.id,
        from: tx.deviceType,
        to: tx.sector,
        amount: tx.amount,
        timestamp: tx.timestamp,
        tx_type: "Transfer" as const,
        location: tx.location
      }));
      setRecentActivity(mappedTxs);
    } catch (error) {
      console.error("Failed to fetch IoT transactions:", error);
    }

    return blocksRes.data;
  }, []);

  // Use smart polling hook - poll every 5 seconds to match backend block time
  const { error: pollingError, retry: retryPolling, isPolling } = useSmartPolling(fetchData, {
    interval: 5000,
    maxRetries: 3,
    backoffFactor: 2
  });

  // Toggle full screen / demo mode
  useEffect(() => {
    const header = document.querySelector('header');
    if (isDemoMode) {
      if (header) header.style.display = 'none';
      document.documentElement.requestFullscreen().catch(e => console.log(e));
    } else {
      if (header) header.style.display = 'flex';
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(e => console.log(e));
      }
    }
    return () => {
      if (header) header.style.display = 'flex';
    };
  }, [isDemoMode]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    if (searchQuery.length > 40) {
      setLocation(`/tx/${searchQuery}`);
    } else {
      console.log("Searching for:", searchQuery);
    }
  };

  // Globe Markers - keep using simulated data for visual effect
  const markers = ALL_GLOBE_MARKERS;

  const getSectorIcon = (sector: string) => {
    switch(sector) {
      case 'Smart City': return <Building2 className="h-4 w-4 text-blue-400" />;
      case 'Industrial IoT': return <Factory className="h-4 w-4 text-orange-400" />;
      case 'Smart Agriculture': return <Leaf className="h-4 w-4 text-green-400" />;
      case 'Healthcare': return <HeartPulse className="h-4 w-4 text-red-400" />;
      case 'Logistics': return <Truck className="h-4 w-4 text-yellow-400" />;
      case 'Energy Grid': return <Zap className="h-4 w-4 text-purple-400" />;
      default: return <ArrowRightLeft className="h-4 w-4" />;
    }
  };

  // Globe Connections
  const currentHashrate = chartData.length > 0 ? chartData[chartData.length - 1]?.hashrate : 0;

  const connections: { start: [number, number]; end: [number, number] }[] = [
    { start: [40.7128, -74.0060], end: [51.5074, -0.1278] },
    { start: [51.5074, -0.1278], end: [35.6762, 139.6503] },
    { start: [35.6762, 139.6503], end: [1.3521, 103.8198] },
    { start: [1.3521, 103.8198], end: [-33.8688, 151.2093] },
    { start: [52.5200, 13.4050], end: [31.2304, 121.4737] },
    { start: [40.7128, -74.0060], end: [-23.5505, -46.6333] },
    { start: [51.5074, -0.1278], end: [25.2048, 55.2708] },
    { start: [35.6762, 139.6503], end: [37.5665, 126.9780] },
    { start: [43.6532, -79.3832], end: [48.8566, 2.3522] },
    { start: [19.0760, 72.8777], end: [25.2048, 55.2708] },
  ];

  return (
    <div className={`flex flex-col ${isDemoMode ? 'h-[calc(100vh-2rem)] overflow-hidden space-y-2' : 'space-y-8'}`}>
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary mb-1">
            <h1 className="text-2xl font-bold tracking-widest text-[#4F75FF] font-['Orbitron'] uppercase">EDGEAI EXPLORER</h1>
          </div>
          <p className="text-muted-foreground font-['Orbitron'] tracking-wide text-lg">Real-time blockchain surveillance system.</p>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>Updated: {lastUpdated}</span>
          <Button 
            variant={isDemoMode ? "default" : "outline"} 
            size="sm" 
            onClick={() => setIsDemoMode(!isDemoMode)}
            className="gap-2"
          >
            {isDemoMode ? <Minimize2 className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
            {isDemoMode ? "Exit Demo" : "Demo Mode"}
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={retryPolling} 
            className={`h-8 w-8 ${isPolling ? '' : 'text-destructive animate-pulse'}`}
            title={isPolling ? "Refreshing automatically" : "Connection lost. Click to retry."}
          >
            <RefreshCw className={`h-4 w-4 ${isPolling ? 'animate-spin-slow' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Search Section */}
      {!isDemoMode && (
      <form onSubmit={handleSearch} className="flex gap-2 max-w-2xl mx-auto w-full">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input 
            placeholder="Search by Block Hash, Tx ID, or Address..." 
            className="pl-10 bg-card border-muted"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button type="submit" variant="secondary">Search</Button>
      </form>
      )}

      {/* Stats Grid */}
      <div className={`grid gap-${isDemoMode ? '2' : '4'} md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 shrink-0`}>
        <Card className="bg-card border-muted">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Block Height</CardTitle>
            <Layers className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.height || '-'}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-muted">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Transactions</CardTitle>
            <Activity className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.txCount}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-muted">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Accounts</CardTitle>
            <Hash className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.accountCount}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-muted">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Network Difficulty</CardTitle>
            <Database className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.difficulty}</div>
          </CardContent>
        </Card>
        
        <Card className="bg-card border-muted col-span-1 md:col-span-2 lg:col-span-1 xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Block Time (Last 20)</CardTitle>
            <Clock className="h-4 w-4 text-cyan-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">{stats.avgBlockTime}s <span className="text-xs font-normal text-muted-foreground">avg</span></div>
            <div className="h-[60px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <Line type="monotone" dataKey="blockTime" stroke="#06b6d4" strokeWidth={2} dot={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '4px', fontSize: '12px' }}
                    itemStyle={{ color: '#06b6d4' }}
                    labelStyle={{ display: 'none' }}
                    formatter={(value: number) => [`${value?.toFixed(1)}s`, 'Time']}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-muted col-span-1 md:col-span-2 lg:col-span-1 xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tx / Block (Last 20)</CardTitle>
            <BarChart className="h-4 w-4 text-pink-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">{stats.avgTxPerBlock} <span className="text-xs font-normal text-muted-foreground">avg</span></div>
            <div className="h-[60px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <Line 
                    type="step" 
                    dataKey="txCount" 
                    stroke="#ec4899" 
                    strokeWidth={2} 
                    dot={false} 
                    isAnimationActive={true}
                    animationDuration={500}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '4px', fontSize: '12px' }}
                    itemStyle={{ color: '#ec4899' }}
                    labelStyle={{ display: 'none' }}
                    formatter={(value: number) => [value, 'Tx Count']}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Network Entropy - PoIE Core Metric */}
        <Card className="bg-card border-muted col-span-1 md:col-span-1 lg:col-span-2 xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Network Entropy</CardTitle>
            <Database className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-1">{stats.networkEntropy.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Total data entropy (PoIE)</p>
          </CardContent>
        </Card>

        {/* TPS - Transactions Per Second */}
        <Card className="bg-card border-muted col-span-1 md:col-span-1 lg:col-span-2 xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">TPS</CardTitle>
            <Zap className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-1">{stats.tps.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Transactions per second</p>
          </CardContent>
        </Card>

        {/* Data Throughput */}
        <Card className="bg-card border-muted col-span-1 md:col-span-1 lg:col-span-2 xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Data Throughput</CardTitle>
            <Activity className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-1">{(stats.dataThroughput / 1024).toFixed(2)} <span className="text-xs font-normal text-muted-foreground">KB/s</span></div>
            <p className="text-xs text-muted-foreground">Network data flow</p>
          </CardContent>
        </Card>

        {/* Validator Power */}
        <Card className="bg-card border-muted col-span-1 md:col-span-1 lg:col-span-2 xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Validator Power</CardTitle>
            <Cpu className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-1">{stats.validatorPower.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">Network processing index</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className={`grid gap-4 md:grid-cols-2 lg:grid-cols-7 ${isDemoMode ? 'flex-1 min-h-0' : ''}`}>
        {/* Globe Section - Keep using simulated data for visual effect */}
        <Card className={`col-span-2 lg:col-span-3 bg-card border-muted overflow-hidden relative h-[600px]`}>
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/80 z-10 pointer-events-none" />
          <CardHeader className="relative z-20">
            <CardTitle className="text-lg font-medium text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-400" />
              Global Node Activity
            </CardTitle>
          </CardHeader>
          <Globe3D 
            className="w-full h-full opacity-80"
            markers={globeMarkers}
            connections={[]}
            heatmapPoints={heatmapPoints}
            scale={1.1}
            sizingMode="fit"
            onMarkerClick={(marker) => {
              if (typeof marker.tooltip === 'string') {
                const cityName = marker.tooltip.split(' Hub')[0].split(' Node')[0];
                setSelectedRegion(cityName);
              }
            }}
          />
          <div className="absolute bottom-4 left-4 z-20 space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <span>{TOTAL_VALIDATOR_COUNT.toLocaleString()}+ Active Nodes</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span>12ms Avg Latency</span>
            </div>
          </div>
        </Card>

        {/* Recent Blocks - Now showing real backend data */}
        <Card className={`col-span-2 lg:col-span-2 bg-card border-muted h-[600px] overflow-hidden flex flex-col`}>
          <CardHeader>
            <CardTitle className="text-lg font-medium text-muted-foreground">Latest Blocks</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden flex flex-col">
            <div className="space-y-4 h-full overflow-y-auto pr-2 custom-scrollbar">
              {latestBlocks.map((block) => (
                <div key={block.hash} className="flex items-center justify-between border-b border-border pb-2 last:border-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className="bg-secondary p-2 rounded-md">
                      <Layers className="h-4 w-4 text-blue-500" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">
                        <Link href={`/block/${block.hash}`} className="hover:text-primary transition-colors">
                          Block #{block.index}
                        </Link>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {(() => {
                          try {
                            let date: Date;
                            if (block.header?.timestamp) {
                              date = new Date(block.header.timestamp);
                            } else if (block.timestamp !== undefined) {
                              date = typeof block.timestamp === 'string' 
                                ? new Date(block.timestamp)
                                : new Date(block.timestamp * 1000);
                            } else {
                              date = new Date();
                            }
                            
                            if (isNaN(date.getTime())) {
                              return "Just now";
                            }
                            return date.toLocaleTimeString();
                          } catch (e) {
                            return "Just now";
                          }
                        })()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">{block.transactions.length} txs</div>
                    <div className="text-xs text-muted-foreground">Reward: 2.5 EDGE</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-2 border-t border-border">
              <Link href="/blocks" className="text-sm text-primary hover:underline w-full text-center block">
                View all blocks
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Recent Transactions - Now from backend IoT API */}
        <Card className={`col-span-2 lg:col-span-2 bg-card border-muted h-[600px] overflow-hidden flex flex-col`}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-medium text-muted-foreground">
              {selectedRegion ? `Transactions in ${selectedRegion}` : 'Recent Transactions'}
            </CardTitle>
            {selectedRegion && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setSelectedRegion(null)}
                className="h-6 px-2 text-xs"
              >
                Clear Filter
              </Button>
            )}
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden flex flex-col">
            <div className="space-y-4 h-full overflow-y-auto pr-2 custom-scrollbar">
              {recentActivity
                .filter(tx => !selectedRegion || (tx as any).location?.includes(selectedRegion))
                .map((tx) => (
                <Dialog key={tx.id}>
                  <DialogTrigger asChild>
                    <div className="flex items-center justify-between border-b border-border pb-2 last:border-0 last:pb-0 cursor-pointer hover:bg-muted/50 p-2 rounded-md transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="bg-secondary p-2 rounded-md">
                          {getSectorIcon(tx.to || '')}
                        </div>
                        <div>
                          <div className="font-mono text-sm truncate max-w-[180px]">{tx.id.substring(0, 32)}...</div>
                          <div className="text-xs text-muted-foreground">From: {tx.from}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-green-500">{tx.amount.toFixed(2)} EDGE</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(tx.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Transaction Details</DialogTitle>
                      <DialogDescription>
                        IoT Data Contribution Transaction
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm text-muted-foreground">Transaction ID</label>
                        <div className="font-mono text-xs break-all bg-muted p-2 rounded">{tx.id}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm text-muted-foreground">Device Type</label>
                          <div className="font-medium">{tx.from}</div>
                        </div>
                        <div>
                          <label className="text-sm text-muted-foreground">Sector</label>
                          <div className="font-medium">{tx.to}</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm text-muted-foreground">Amount</label>
                          <div className="font-medium text-green-500">{tx.amount.toFixed(4)} EDGE</div>
                        </div>
                        <div>
                          <label className="text-sm text-muted-foreground">Time</label>
                          <div className="font-medium">{new Date(tx.timestamp).toLocaleString()}</div>
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              ))}
            </div>
            <div className="mt-4 pt-2 border-t border-border">
              <Link href="/transactions" className="text-sm text-primary hover:underline w-full text-center block">
                View all transactions
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
