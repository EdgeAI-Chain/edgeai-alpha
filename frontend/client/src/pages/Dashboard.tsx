import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiCall, Block, Transaction } from "@/lib/api";
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
import { generateIoTTransaction, getIoTTransactions, IoTTransaction } from "@/lib/iotGenerator";
import { TOTAL_VALIDATOR_COUNT } from "@/lib/validators";

export default function Dashboard() {
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [stats, setStats] = useState({
    height: 0,
    txCount: 3355, // Simulated total for demo match
    accountCount: 2625, // Simulated total for demo match
    difficulty: 2.14,
    avgBlockTime: 0,
    avgTxPerBlock: 0
  });
  const [latestBlocks, setLatestBlocks] = useState<Block[]>([]);
  const [recentActivity, setRecentActivity] = useState<Transaction[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [, setLocation] = useLocation();
  const [heatmapPoints, setHeatmapPoints] = useState<{lat: number, lon: number, value: number}[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  
  // Use transaction simulator for globe visualization
  const { markers: globeMarkers, activeTransactions: simulatedTxs } = useTransactionSimulator(true);

  // Wrap fetchData in useCallback to be stable for useSmartPolling
  const fetchData = useCallback(async () => {
    const now = new Date();
    setLastUpdated(now.toLocaleTimeString());

    // Fetch blocks (fetch more to calculate averages)
    const blocksRes = await apiCall<Block[]>('/blocks?limit=20');
    
    if (!blocksRes.success) {
      throw new Error(blocksRes.error || "Failed to fetch blocks");
    }

    if (Array.isArray(blocksRes.data)) {
      const blocks = blocksRes.data;
      
      // Monotonic Guard: Check if API data is older than local simulation
      // If local height is higher, we should NOT overwrite with API data
      // Instead, we might want to merge or just ignore the API update for the blocks list
      setLatestBlocks(prev => {
        // If we have local blocks and the API returns blocks with lower height,
        // keep our local blocks to maintain the "infinite growth" illusion
        if (prev.length > 0 && blocks.length > 0) {
          const localHeight = prev[0].index;
          const apiHeight = blocks[0].index;
          
          if (localHeight > apiHeight) {
            return prev; // Keep local simulation
          }
        }
        return blocks.slice(0, 10); // Use API data if it's newer or we have no local data
      });
      
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
            const t1 = typeof block.timestamp === 'number' && block.timestamp < 10000000000 
              ? block.timestamp * 1000 
              : (typeof block.timestamp === 'string' ? new Date(block.timestamp).getTime() : block.timestamp);
              
            const prevBlock = sortedBlocks[i-1];
            const t2 = typeof prevBlock.timestamp === 'number' && prevBlock.timestamp < 10000000000 
              ? prevBlock.timestamp * 1000 
              : (typeof prevBlock.timestamp === 'string' ? new Date(prevBlock.timestamp).getTime() : prevBlock.timestamp);
            
            const diff = (t1 - t2) / 1000; // seconds
            if (diff > 0 && diff < 3600) {
              blockTime = diff;
              totalTimeDiff += diff;
              validDiffs++;
            }
          }

          totalTx += txCount;
          
          // Estimate hashrate: Difficulty / BlockTime
          // If blockTime is 0 or null, use average or skip
          // For visualization, we'll use a simple metric: Difficulty * (TargetTime / ActualTime)
          // Assuming target time is 12s
          const difficulty = block.difficulty || 2;
          const estimatedHashrate = blockTime > 0 ? (difficulty / blockTime) * 100 : 0; // Arbitrary scale for demo

          // Add realistic fluctuation to txCount for visualization if it's too static
          // This creates a "heartbeat" effect while keeping the average roughly correct
          // We use a deterministic random based on block index so it doesn't flicker on refresh
          const fluctuation = Math.sin(block.index * 0.5) * 3 + (Math.cos(block.index * 0.2) * 2);
          const visualTxCount = Math.max(1, Math.round(txCount + fluctuation));

          newChartData.push({
            height: block.index,
            txCount: visualTxCount,
            realTxCount: txCount, // Keep real count for tooltip if needed
            blockTime: blockTime > 0 ? blockTime : null,
            hashrate: estimatedHashrate > 0 ? estimatedHashrate : null
          });
        }

        const avgTime = validDiffs > 0 ? totalTimeDiff / validDiffs : 12; // Default to 12s if no data
        const avgTx = totalTx / blocks.length;

        setStats(prev => {
          // Monotonic Guard: Ensure block height never decreases
          // If server returns older block height than our local simulation, keep local height
          const apiHeight = blocks[0].index;
          const newHeight = apiHeight > prev.height ? apiHeight : prev.height;
          
          return { 
            ...prev, 
            height: newHeight,
            // Only update difficulty if we're using API data, otherwise keep simulated difficulty
            difficulty: apiHeight > prev.height ? (blocks[0].difficulty || 2) : prev.difficulty,
            avgBlockTime: parseFloat(avgTime.toFixed(1)),
            avgTxPerBlock: parseFloat(avgTx.toFixed(1))
          };
        });
        
        // Only update chart data if it's the first load or if we want to sync
        // For now, we let the simulation handle the chart updates to avoid jitter
        if (chartData.length === 0) {
          setChartData(newChartData);
        }
        
        // Use getIoTTransactions to ensure consistency with Transactions page
        // We use page 1 and limit to 5 items for the dashboard view
        const consistentTxs = getIoTTransactions(1, 9);
        // Map IoTTransaction to Transaction interface expected by Dashboard
        const mappedTxs = consistentTxs.map(tx => ({
          id: tx.id,
          from: tx.deviceType, // Use device type as sender for display
          to: tx.sector, // Use sector as receiver for display
          amount: tx.amount,
          timestamp: tx.timestamp,
          tx_type: "Transfer" as const,
          location: tx.location // Add location for filtering
        }));
        setRecentActivity(mappedTxs);
      }
    }
    return blocksRes.data;
  }, [chartData.length]); // Dependency on chartData.length to initialize once

  // Use smart polling hook
  const { error: pollingError, retry: retryPolling, isPolling } = useSmartPolling(fetchData, {
    interval: 10000, // Poll every 10s (less frequent than simulation)
    maxRetries: 3,
    backoffFactor: 2
  });

  // Live Block Simulation Effect
  useEffect(() => {
    if (chartData.length === 0) return;

    const interval = setInterval(() => {
      setChartData(currentData => {
        if (currentData.length === 0) return currentData;

        const lastBlock = currentData[currentData.length - 1];
        const nextIndex = lastBlock.height + 1;
        
        // Generate realistic fluctuating tx count
        // Use a continuous time-based noise for smoother transitions than pure random
        const time = Date.now() / 1000;
        const baseTx = 6; // Average tx per block
        const noise = Math.sin(time) * 2 + Math.cos(time * 2.5) * 1.5 + (Math.random() - 0.5) * 2;
        const nextTxCount = Math.max(1, Math.round(baseTx + noise));
        
        // Simulate block time (mostly 3s for this fast demo, with some jitter)
        const nextBlockTime = 3 + (Math.random() * 0.5); 
        
          // Estimate hashrate with more fluctuation
        // Dynamic difficulty fluctuation
        // Base difficulty 2.14 + sine wave oscillation + random noise
        const baseDifficulty = 2.14;
        const difficultyNoise = Math.sin(time * 0.2) * 0.05 + (Math.random() - 0.5) * 0.02;
        const nextDifficulty = parseFloat((baseDifficulty + difficultyNoise).toFixed(4));

        // Add significant noise to hashrate to make the chart look more active
        // Base calculation + sine wave oscillation + random noise
        const baseHashrate = (nextDifficulty / nextBlockTime) * 100;
        const hashrateNoise = Math.sin(time * 0.5) * 15 + (Math.random() - 0.5) * 10;
        const nextHashrate = Math.max(40, baseHashrate + hashrateNoise);

        const newBlock = {
          height: nextIndex,
          txCount: nextTxCount,
          realTxCount: nextTxCount,
          blockTime: nextBlockTime,
          hashrate: nextHashrate
        };

        // Scroll: Remove first, add new
        const newData = [...currentData.slice(1), newBlock];
        
        // Update stats to reflect latest block
        setStats(prev => ({
          ...prev,
          height: nextIndex,
          difficulty: nextDifficulty,
          txCount: prev.txCount + nextTxCount,
          avgBlockTime: parseFloat(((prev.avgBlockTime * 19 + nextBlockTime) / 20).toFixed(1)),
          avgTxPerBlock: parseFloat(((prev.avgTxPerBlock * 19 + nextTxCount) / 20).toFixed(1))
        }));

        // Update latest blocks list to show the new block at the top
        setLatestBlocks(prev => {
          const newBlockObj: Block = {
            index: nextIndex,
            hash: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
            timestamp: Date.now(),
            transactions: Array(nextTxCount).fill(0).map((_, i) => ({
              id: Math.random().toString(36).substring(2, 15),
              from: "0x" + Math.random().toString(16).substring(2, 42),
              to: "0x" + Math.random().toString(16).substring(2, 42),
              amount: Math.random() * 100,
              timestamp: new Date().toISOString(),
              tx_type: "Transfer"
            })),
            difficulty: 2.14,
            previous_hash: prev[0]?.hash || "0x0000000000000000000000000000000000000000",
            validator: "edge_node_" + Math.floor(Math.random() * 100).toString().padStart(2, '0'),
            entropy: Math.random() * 5
          };
          return [newBlockObj, ...prev.slice(0, 9)];
        });

        // Simulate new transactions using IoT generator
        const newTxsCount = Math.floor(Math.random() * 5) + 1;
        const newTransactions = Array(newTxsCount).fill(0).map((_, i) => {
          // Use current time as seed component to get "new" random transactions
          return generateIoTTransaction(Date.now() + i);
        });
        
        // Update recent activity with new transactions to keep it alive
        setRecentActivity(prev => {
          const newActivity = newTransactions.map(tx => ({
            id: tx.id,
            from: tx.deviceType,
            to: tx.sector,
            amount: tx.amount,
            timestamp: tx.timestamp,
            tx_type: "Transfer" as const,
            location: tx.location // Add location for filtering
          }));
          return [...newActivity, ...prev].slice(0, 9);
        });

        // Update heatmap points based on new transactions
        const newHeatmapPoints = newTransactions.map(tx => ({
          lat: tx.coordinates[0],
          lon: tx.coordinates[1],
          value: 1.0 // Start hot
        }));

        setHeatmapPoints(prev => {
          // Decay existing points
          const decayed = prev.map(p => ({ ...p, value: p.value * 0.9 })).filter(p => p.value > 0.1);
          // Add new points
          return [...decayed, ...newHeatmapPoints];
        });

        return newData;
      });
    }, 3000); // New block every 3 seconds

    return () => clearInterval(interval);
  }, [chartData.length > 0]); // Start once we have initial data

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
    
    // Simple heuristic: if it looks like a hash (long string), try to go to tx details
    // In a real app, we would check if it's a block hash, tx hash, or address
    if (searchQuery.length > 40) {
      setLocation(`/tx/${searchQuery}`);
    } else {
      console.log("Searching for:", searchQuery);
    }
  };

  // Globe Markers
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
  const currentHashrate = chartData.length > 0 ? chartData[chartData.length - 1].hashrate : 0;

  const connections: { start: [number, number]; end: [number, number] }[] = [
    { start: [40.7128, -74.0060], end: [51.5074, -0.1278] }, // NY -> London
    { start: [51.5074, -0.1278], end: [35.6762, 139.6503] }, // London -> Tokyo
    { start: [35.6762, 139.6503], end: [1.3521, 103.8198] }, // Tokyo -> Singapore
    { start: [1.3521, 103.8198], end: [-33.8688, 151.2093] }, // Singapore -> Sydney
    { start: [52.5200, 13.4050], end: [31.2304, 121.4737] }, // Berlin -> Shanghai
    { start: [40.7128, -74.0060], end: [-23.5505, -46.6333] }, // NY -> Sao Paulo
    { start: [51.5074, -0.1278], end: [25.2048, 55.2708] }, // London -> Dubai
    { start: [35.6762, 139.6503], end: [37.5665, 126.9780] }, // Tokyo -> Seoul
    { start: [43.6532, -79.3832], end: [48.8566, 2.3522] }, // Toronto -> Paris
    { start: [19.0760, 72.8777], end: [25.2048, 55.2708] }, // Mumbai -> Dubai
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
                    formatter={(value: number) => [`${value.toFixed(1)}s`, 'Time']}
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
                    isAnimationActive={true} // Enable animation
                    animationDuration={500} // Smooth transition for new points
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

        <Card className="bg-card border-muted col-span-1 md:col-span-2 lg:col-span-3 xl:col-span-4">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Network Hashrate (Estimated)</CardTitle>
            <Cpu className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">{currentHashrate?.toFixed(2) || '0.00'} <span className="text-xs font-normal text-muted-foreground">EH/s</span></div>
            <div className="h-[60px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorHashrate" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="hashrate" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorHashrate)" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '4px', fontSize: '12px' }}
                    itemStyle={{ color: '#8b5cf6' }}
                    labelStyle={{ display: 'none' }}
                    formatter={(value: number) => [`${value.toFixed(2)} EH/s`, 'Hashrate']}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className={`grid gap-4 md:grid-cols-2 lg:grid-cols-7 ${isDemoMode ? 'flex-1 min-h-0' : ''}`}>
        {/* Globe Section */}
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
              // Extract city name from tooltip (e.g., "New York Hub" -> "New York")
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

        {/* Recent Blocks */}
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
                            const date = typeof block.timestamp === 'string' 
                              ? new Date(block.timestamp)
                              : new Date(block.timestamp * 1000);
                            
                            if (isNaN(date.getTime())) {
                              // Fallback for invalid dates - use a relative time based on block index difference
                              // This prevents "Invalid Date" flash during initial load or bad data
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
                    <div className="text-xs text-muted-foreground">Reward: {(block as any).reward || '2.5'} EDGE</div>
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

        {/* Recent Transactions */}
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
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate max-w-[120px]">
                            {tx.id}
                          </div>
                          <div className="text-xs text-muted-foreground truncate max-w-[120px]">
                            From: {tx.from}
                          </div>
                        </div>
                      </div>
                      <div className="text-right whitespace-nowrap">
                        <div className="text-sm font-medium">{(tx.amount || 0).toFixed(2)} EDGE</div>
                        <div className="text-xs text-muted-foreground">{new Date(tx.timestamp).toLocaleTimeString()}</div>
                      </div>
                    </div>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Transaction Details</DialogTitle>
                      <DialogDescription className="sr-only">
                        Detailed information about transaction {tx.id}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="flex justify-center p-4 bg-white rounded-lg">
                        <QRCode value={`${window.location.origin}/tx/${tx.id}`} size={150} />
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between border-b border-border pb-2">
                          <span className="text-muted-foreground">Tx ID</span>
                          <span className="font-mono text-xs truncate max-w-[200px]">{tx.id}</span>
                        </div>
                        <div className="flex justify-between border-b border-border pb-2">
                          <span className="text-muted-foreground">From (Device)</span>
                          <span className="font-medium">{tx.from}</span>
                        </div>
                        <div className="flex justify-between border-b border-border pb-2">
                          <span className="text-muted-foreground">To (Sector)</span>
                          <span className="font-medium">{tx.to}</span>
                        </div>
                        <div className="flex justify-between border-b border-border pb-2">
                          <span className="text-muted-foreground">Amount</span>
                          <span className="font-bold text-green-500">{(tx.amount || 0).toFixed(4)} EDGE</span>
                        </div>
                        <div className="flex justify-between border-b border-border pb-2">
                          <span className="text-muted-foreground">Time</span>
                          <span>{new Date(tx.timestamp).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Type</span>
                          <Badge variant="outline">{tx.tx_type}</Badge>
                        </div>
                      </div>
                      <div className="pt-2">
                        <Link href={`/tx/${tx.id}`}>
                          <Button className="w-full">View Full Details</Button>
                        </Link>
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
