import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DemandTrendChart } from "@/components/DemandTrendChart";
import { ArrowUpRight, ArrowDownLeft, ShoppingBag, Clock, DollarSign } from "lucide-react";;

interface Trade {
  id: string;
  price: number;
  amount: number;
  time: string;
  type: 'buy' | 'sell';
  asset: string;
  trend: number;
  basePrice: number;
  qualityScore: number;
  demandMultiplier: number;
}

export default function Marketplace() {
  const [recentTrades, setRecentTrades] = useState<Trade[]>([]);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('All');

  const assetTypes = ['All', 'Compute', 'Storage', 'IoT', 'AI', 'Sensor'];

  const filteredTrades = filter === 'All' 
    ? recentTrades 
    : recentTrades.filter(trade => trade.asset.toLowerCase().includes(filter.toLowerCase()));

  // Fetch real-time data from DexScreener
  const fetchRealData = async () => {
    try {
      const res = await fetch("https://api.dexscreener.com/latest/dex/pairs/bsc/0x47f93f12853c8ba0d8a81fdac3867d993e2ebd06");
      const data = await res.json();
      
      if (data.pairs && data.pairs[0]) {
        const pair = data.pairs[0];
        const price = parseFloat(pair.priceUsd);
        setCurrentPrice(price);
        return price;
      }
    } catch (e) {
      console.error("Failed to fetch DexScreener data", e);
    }
    return 42.50; // Fallback
  };

  // Initialize data
  useEffect(() => {
    const init = async () => {
      const price = await fetchRealData();
      
      // Generate initial trades
      const assets = ['Compute Credits', 'IoT Data Stream', 'Storage (1TB)', 'AI Model Access', 'Sensor Data'];
      const initialTrades = Array(20).fill(0).map((_, i) => {
        const basePrice = parseFloat((price * (0.8 + Math.random() * 0.4)).toFixed(2));
        const qualityScore = parseFloat((0.7 + Math.random() * 0.3).toFixed(2)); // 0.7 - 1.0
        const demandMultiplier = parseFloat((0.9 + Math.random() * 0.4).toFixed(2)); // 0.9 - 1.3
        const finalPrice = basePrice * (1 + 0.5 * qualityScore) * demandMultiplier;

        return {
          id: Math.random().toString(36).substring(7),
          price: parseFloat(finalPrice.toFixed(4)),
          amount: parseFloat((Math.random() * 50 + 5).toFixed(2)),
          time: new Date(Date.now() - i * 60000).toLocaleTimeString(),
          type: Math.random() > 0.5 ? 'buy' : 'sell' as 'buy' | 'sell',
          asset: assets[Math.floor(Math.random() * assets.length)],
          trend: (Math.random() - 0.5) * 10,
          basePrice,
          qualityScore,
          demandMultiplier
        };
      });
      setRecentTrades(initialTrades);
      setLoading(false);
    };

    init();
  }, []);

  // Simulate live market activity anchored to real price
  useEffect(() => {
    if (loading || currentPrice === 0) return;

    const interval = setInterval(() => {
      // 1. Update Current Price (micro-fluctuations around real price)
      const fluctuation = (Math.random() - 0.5) * (currentPrice * 0.005);
      const newPrice = parseFloat((currentPrice + fluctuation).toFixed(4));
      
      // Occasionally fetch real data to re-anchor
      if (Math.random() > 0.9) {
        fetchRealData();
      } else {
        setCurrentPrice(newPrice);
      }

      // 2. Add new trade
      const assets = ['Compute Credits', 'IoT Data Stream', 'Storage (1TB)', 'AI Model Access', 'Sensor Data'];
      const type = Math.random() > 0.5 ? 'buy' : 'sell';
      
      const basePrice = parseFloat((newPrice * (0.8 + Math.random() * 0.4)).toFixed(2));
      const qualityScore = parseFloat((0.7 + Math.random() * 0.3).toFixed(2));
      const demandMultiplier = parseFloat((0.9 + Math.random() * 0.4).toFixed(2));
      const finalPrice = basePrice * (1 + 0.5 * qualityScore) * demandMultiplier;

      const newTrade: Trade = {
        id: Math.random().toString(36).substring(7),
        price: parseFloat(finalPrice.toFixed(4)),
        amount: parseFloat((Math.random() * 50 + 5).toFixed(2)),
        time: new Date().toLocaleTimeString(),
        type: type as 'buy' | 'sell',
        asset: assets[Math.floor(Math.random() * assets.length)],
        trend: (Math.random() - 0.5) * 10,
        basePrice,
        qualityScore,
        demandMultiplier
      };

      setRecentTrades(prev => [newTrade, ...prev.slice(0, 19)]);

    }, 2000); // Update every 2 seconds

    return () => clearInterval(interval);
  }, [currentPrice]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ShoppingBag className="h-8 w-8 text-primary" />
            Market Place
          </h1>
          <p className="text-muted-foreground mt-1">
            Live trading activity for digital assets and resources.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {assetTypes.map((type) => (
            <Button
              key={type}
              variant={filter === type ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(type)}
              className="text-xs"
            >
              {type}
            </Button>
          ))}
        </div>
      </div>

      <DemandTrendChart />

      {/* Recent Trades */}
      <Card className="bg-card/50 border-muted">
        <CardHeader>
          <CardTitle className="text-lg font-medium">Recent Trades</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredTrades.map((trade) => (
              <div key={trade.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0 last:pb-0">
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-full ${trade.type === 'buy' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                    {trade.type === 'buy' ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                  </div>
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {trade.asset}
                      <Badge variant="outline" className={`text-[10px] h-5 px-1 ${
                        trade.qualityScore > 0.9 ? 'border-green-500 text-green-500' : 
                        trade.qualityScore > 0.8 ? 'border-blue-500 text-blue-500' : 'border-yellow-500 text-yellow-500'
                      }`}>
                        AI Score: {(trade.qualityScore * 100).toFixed(0)}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <Clock className="h-3 w-3" />
                      {trade.time}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="font-medium flex items-center justify-end gap-1 cursor-help">
                          {trade.price.toFixed(4)} <span className="text-xs text-muted-foreground">EDGE</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="w-64 p-3">
                        <div className="space-y-2">
                          <div className="text-center border-b border-border pb-2 mb-2">
                            <p className="font-semibold">PoV Pricing Breakdown</p>
                            <p className="text-xs text-muted-foreground">Proof of Value Protocol</p>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                            <span className="text-muted-foreground">Base Ask:</span>
                            <span className="text-right font-mono">{trade.basePrice.toFixed(2)} EDGE</span>
                            
                            <span className="text-muted-foreground">Quality Premium:</span>
                            <span className="text-right font-mono text-green-500">
                              +{(trade.basePrice * 0.5 * trade.qualityScore).toFixed(2)} EDGE
                            </span>
                            
                            <span className="text-muted-foreground">Demand Mult:</span>
                            <span className="text-right font-mono text-blue-500">x{trade.demandMultiplier.toFixed(2)}</span>
                            
                            <div className="col-span-2 border-t border-border my-1"></div>
                            
                            <span className="font-semibold">Final Price:</span>
                            <span className="text-right font-bold font-mono">{trade.price.toFixed(2)} EDGE</span>
                          </div>

                          <div className="pt-2 border-t border-border mt-2 text-center">
                            <p className="text-xs text-muted-foreground mb-1">USD Valuation</p>
                            <p className="font-medium">≈ ${(trade.price * currentPrice).toFixed(2)} USD</p>
                            <p className={`text-[10px] ${trade.trend >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                              {trade.trend >= 0 ? '↑' : '↓'} {Math.abs(trade.trend).toFixed(2)}% (24h)
                            </p>
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <div className="text-xs text-muted-foreground">
                    {trade.amount.toFixed(2)} units
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
