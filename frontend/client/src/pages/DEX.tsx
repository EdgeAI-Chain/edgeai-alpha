import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, BarChart3, Maximize2, Minimize2, ArrowRightLeft, Droplets } from "lucide-react";
import { fetchPairs, fetchTrades, getSwapQuote, executeSwap, PairStats, Trade as DexTrade, formatNumber, formatPrice } from "@/lib/dexApi";
import { toast } from "sonner";
import { TradingPanel } from "@/components/TradingPanel";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { CandleStickChart } from "@/components/CandleStickChart";
import { DepthChart } from "@/components/DepthChart";
import { CandlestickData, Time } from 'lightweight-charts';

interface Order {
  price: number;
  amount: number;
  total: number;
  type: 'buy' | 'sell';
}

export default function DEX() {
  const [orderBook, setOrderBook] = useState<{ bids: Order[], asks: Order[] }>({ bids: [], asks: [] });
  const [priceHistory, setPriceHistory] = useState<(CandlestickData<Time> & { volume: number })[]>([]);
  const [maData, setMaData] = useState<{ ma7: any[], ma25: any[], ma99: any[] } | undefined>(undefined);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [marketStats, setMarketStats] = useState({
    volume24h: 0,
    high24h: 0,
    low24h: 0,
    change24h: 0
  });
  const [depthData, setDepthData] = useState<{ price: number, bidDepth: number, askDepth: number }[]>([]);
  const [timeFrame, setTimeFrame] = useState<'1H' | '4H' | '1D'>('1H');
  const [chartType, setChartType] = useState<'line' | 'candle'>('candle');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pairs, setPairs] = useState<PairStats[]>([]);
  const [selectedPair, setSelectedPair] = useState<string>('EDGE-USDT');
  const [recentTrades, setRecentTrades] = useState<DexTrade[]>([]);
  const [swapAmount, setSwapAmount] = useState<string>('');
  const [swapDirection, setSwapDirection] = useState<'buy' | 'sell'>('buy');
  const [swapQuote, setSwapQuote] = useState<{ amountOut: number; fee: number; priceImpact: number } | null>(null);

  // Toggle full screen mode
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullScreen(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  // Fetch trading pairs from backend
  useEffect(() => {
    const loadPairs = async () => {
      const pairsData = await fetchPairs();
      if (pairsData.length > 0) {
        setPairs(pairsData);
        // Update market stats from selected pair
        const selected = pairsData.find(p => p.pair.id === selectedPair);
        if (selected) {
          setCurrentPrice(selected.price);
          setMarketStats({
            volume24h: selected.pair.volume_24h,
            high24h: selected.high_24h,
            low24h: selected.low_24h,
            change24h: selected.price_change_24h
          });
        }
      }
    };
    loadPairs();
    const interval = setInterval(loadPairs, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, [selectedPair]);

  // Fetch recent trades
  useEffect(() => {
    const loadTrades = async () => {
      const trades = await fetchTrades(selectedPair);
      setRecentTrades(trades);
    };
    loadTrades();
  }, [selectedPair]);

  // Get swap quote when amount changes
  useEffect(() => {
    const getQuote = async () => {
      const amount = parseFloat(swapAmount);
      if (isNaN(amount) || amount <= 0) {
        setSwapQuote(null);
        return;
      }
      const quote = await getSwapQuote(selectedPair, amount, swapDirection === 'sell');
      if (quote) {
        setSwapQuote({
          amountOut: quote.amount_out,
          fee: quote.fee,
          priceImpact: quote.price_impact
        });
      }
    };
    const debounce = setTimeout(getQuote, 300);
    return () => clearTimeout(debounce);
  }, [swapAmount, swapDirection, selectedPair]);

  // Handle swap execution
  const handleSwap = async () => {
    const amount = parseFloat(swapAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    toast.info('Executing swap...');
    const result = await executeSwap(
      selectedPair,
      amount,
      swapDirection === 'sell',
      'demo_user' // In production, use actual wallet address
    );
    if (result) {
      toast.success(`Swap successful! Received ${result.total} tokens`);
      setSwapAmount('');
      setSwapQuote(null);
      // Refresh data
      const pairsData = await fetchPairs();
      setPairs(pairsData);
      const trades = await fetchTrades(selectedPair);
      setRecentTrades(trades);
    } else {
      toast.error('Swap failed. Please try again.');
    }
  };

  // Fetch real-time data from DexScreener
  const fetchRealData = async () => {
    try {
      // Use a timeout to prevent long hangs
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      const res = await fetch("https://api.dexscreener.com/latest/dex/pairs/bsc/0x47f93f12853c8ba0d8a81fdac3867d993e2ebd06", {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      
      const data = await res.json();
      
      if (data.pairs && data.pairs[0]) {
        const pair = data.pairs[0];
        const price = parseFloat(pair.priceUsd);
        const volume = pair.volume.h24;
        const change = pair.priceChange.h24;
        
        setCurrentPrice(price);
        setMarketStats({
          volume24h: volume,
          high24h: price * (1 + Math.abs(change/100) + 0.02), // Estimate high based on change
          low24h: price * (1 - Math.abs(change/100) - 0.02),  // Estimate low based on change
          change24h: change
        });
        return price;
      }
    } catch (e) {
      console.warn("Using simulated data due to API error:", e);
      // Fallback to simulated data if API fails
      const simulatedPrice = 3.42; // Use a realistic fallback price
      const simulatedChange = 2.5;
      
      setCurrentPrice(simulatedPrice);
      setMarketStats({
        volume24h: 1250000,
        high24h: simulatedPrice * 1.05,
        low24h: simulatedPrice * 0.95,
        change24h: simulatedChange
      });
      return simulatedPrice;
    }
    return 3.42; // Fallback
  };

  // Initialize data
  useEffect(() => {
    const init = async () => {
      const price = await fetchRealData();
      
      // Generate initial order book
      const generateOrders = (basePrice: number, type: 'buy' | 'sell', count: number) => {
      return Array(count).fill(0).map((_, i) => {
        const priceOffset = type === 'buy' ? -Math.random() * 2 : Math.random() * 2;
        const price = basePrice + priceOffset;
        const amount = Math.random() * 100 + 10;
        return {
          price: parseFloat(price.toFixed(2)),
          amount: parseFloat(amount.toFixed(2)),
          total: parseFloat((price * amount).toFixed(2)),
          type
        };
      }).sort((a, b) => type === 'buy' ? b.price - a.price : a.price - b.price);
    };

      setOrderBook({
        bids: generateOrders(price * 0.99, 'buy', 15),
        asks: generateOrders(price * 1.01, 'sell', 15)
      });

      // Generate price history using Brownian Bridge to ensure smooth convergence
      const generateHistory = (currentPrice: number, change24h: number, tf: '1H' | '4H' | '1D') => {
        const points = 300;
        let interval = 120; // 2 min in seconds (1H view)
        let volatility = 0.002;

        if (tf === '4H') {
          interval = 600; // 10 min (4H view)
          volatility = 0.005;
        } else if (tf === '1D') {
          interval = 3600; // 1 hour (1D view)
          volatility = 0.01;
        }

        const now = Math.floor(Date.now() / 1000);
        const data: (CandlestickData<Time> & { volume: number })[] = [];
        
        // Calculate start price based on 24h change
        const startPrice = currentPrice / (1 + (change24h / 100));
        
        // Generate a random walk first
        const randomWalk: number[] = [startPrice];
        let price = startPrice;
        for (let i = 1; i <= points; i++) {
          const change = (Math.random() - 0.5) * (currentPrice * volatility);
          price += change;
          randomWalk.push(price);
        }

        // Apply Brownian Bridge adjustment
        // B(t) = W(t) - (t/T) * (W(T) - Target)
        // This forces the random walk to end exactly at currentPrice
        const finalWalkPrice = randomWalk[points];
        const targetPrice = currentPrice;
        const totalError = finalWalkPrice - targetPrice;

        const bridgedPrices = randomWalk.map((p, i) => {
          const adjustment = (i / points) * totalError;
          return p - adjustment;
        });

        // Convert bridged prices to OHLC candles
        for (let i = 0; i < points; i++) {
          const time = (now - (points - 1 - i) * interval) as Time;
          
          const open = bridgedPrices[i];
          const close = bridgedPrices[i + 1];
          
          // Generate High/Low based on Open/Close
          const bodyHigh = Math.max(open, close);
          const bodyLow = Math.min(open, close);
          
          // Add some wick volatility
          const wickVolatility = currentPrice * volatility * 0.3;
          const high = bodyHigh + Math.random() * wickVolatility;
          const low = bodyLow - Math.random() * wickVolatility;
          
          // Volume spikes on larger moves
          const moveSize = Math.abs(close - open);
          const volumeBase = 1000;
          const volume = volumeBase + (moveSize / currentPrice) * 100000 + Math.random() * 500;
          
          data.push({
            time,
            open,
            high,
            low,
            close,
            volume,
          });
        }

        return data;
      };

      // Get change from marketStats or default to 0
      const change = marketStats.change24h || 0;
      setPriceHistory(generateHistory(price, change, timeFrame));
      setLoading(false);
    };

    init();
  }, [timeFrame]);

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

      // 2. Update Order Book (simulate shifting liquidity)
      setOrderBook(prev => {
        const newBids = prev.bids.map(order => ({
          ...order,
          amount: Math.max(0, order.amount + (Math.random() - 0.5) * 10),
          price: parseFloat((order.price + (Math.random() - 0.5) * (currentPrice * 0.001)).toFixed(4))
        })).sort((a, b) => b.price - a.price);

        const newAsks = prev.asks.map(order => ({
          ...order,
          amount: Math.max(0, order.amount + (Math.random() - 0.5) * 10),
          price: parseFloat((order.price + (Math.random() - 0.5) * (currentPrice * 0.001)).toFixed(4))
        })).sort((a, b) => a.price - b.price);

        // Generate Depth Chart Data
        const depthPoints: { price: number, bidDepth: number, askDepth: number }[] = [];
        let cumulativeBid = 0;
        let cumulativeAsk = 0;

        // Process bids (descending price)
        [...newBids].sort((a, b) => b.price - a.price).forEach(bid => {
          cumulativeBid += bid.amount;
          depthPoints.push({ price: bid.price, bidDepth: cumulativeBid, askDepth: 0 });
        });

        // Process asks (ascending price)
        [...newAsks].sort((a, b) => a.price - b.price).forEach(ask => {
          cumulativeAsk += ask.amount;
          depthPoints.push({ price: ask.price, bidDepth: 0, askDepth: cumulativeAsk });
        });

        // Sort by price for the chart
        setDepthData(depthPoints.sort((a, b) => a.price - b.price));

        return { bids: newBids, asks: newAsks };
      });

      // 3. Update Price History occasionally
      if (Math.random() > 0.7) {
        setPriceHistory(prev => {
          const lastCandle = prev[prev.length - 1] as any;
          const newTime = (lastCandle.time as number) + 60 as Time; // Simplified update
          const open = lastCandle.close;
          const close = newPrice;
          const high = Math.max(open, close) + Math.random() * 0.05;
          const low = Math.min(open, close) - Math.random() * 0.05;
          
          return [...prev.slice(1), {
            time: newTime,
            open,
            high,
            low,
            close,
            volume: Math.random() * 1000 + 500
          }];
        });
      }

    }, 2000); // Update every 2 seconds

    return () => clearInterval(interval);
  }, [currentPrice]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-primary" />
            DEX
          </h1>
          <p className="text-muted-foreground mt-1">
            Decentralized exchange for compute, storage, and IoT data streams.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="sm" 
            className="hidden lg:flex gap-2"
            onClick={() => setIsFullScreen(true)}
          >
            <Maximize2 className="h-4 w-4" />
            Pro Mode
          </Button>
          <div className="grid grid-cols-3 gap-4 text-sm w-full lg:w-auto">
            <div className="flex flex-col items-start lg:items-end">
            <span className="text-muted-foreground text-xs md:text-sm">24h Volume</span>
            <span className="font-mono font-bold text-primary text-sm md:text-base">${marketStats.volume24h.toLocaleString()}</span>
          </div>
          <div className="flex flex-col items-start lg:items-end">
            <span className="text-muted-foreground text-xs md:text-sm">24h High</span>
            <span className="font-mono font-bold text-sm md:text-base">${marketStats.high24h.toFixed(4)}</span>
          </div>
          <div className="flex flex-col items-start lg:items-end">
            <span className="text-muted-foreground text-xs md:text-sm">24h Low</span>
            <span className="font-mono font-bold text-sm md:text-base">${marketStats.low24h.toFixed(4)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Full Screen Pro Mode Overlay */}
      {isFullScreen && (
        <div className="fixed inset-0 z-50 bg-background text-foreground flex flex-col overflow-hidden">
          {/* Pro Header */}
          <div className="h-12 border-b border-border flex items-center justify-between px-4 bg-card/50">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 font-bold text-lg">
                <BarChart3 className="h-5 w-5 text-primary" />
                EDGE/USD
              </div>
              <div className="h-4 w-px bg-border mx-2" />
              <div className="flex gap-4 text-sm">
                <span className="font-mono text-primary">${currentPrice.toFixed(4)}</span>
                <span className={marketStats.change24h >= 0 ? "text-[#0ecb81]" : "text-[#f6465d]"}>
                  {marketStats.change24h >= 0 ? "+" : ""}{marketStats.change24h}%
                </span>
                <span className="text-muted-foreground">Vol: ${marketStats.volume24h.toLocaleString()}</span>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setIsFullScreen(false)}>
              <Minimize2 className="h-4 w-4 mr-2" />
              Exit Pro Mode
            </Button>
          </div>

          {/* Pro Grid Layout */}
          <div className="flex-1 grid grid-cols-12 gap-1 p-1 bg-background">
            {/* Main Chart Area (Left 70%) */}
            <div className="col-span-9 bg-card/30 border border-border/50 rounded-sm overflow-hidden flex flex-col">
              <div className="h-10 border-b border-border/50 flex items-center px-2 gap-2">
                {(['1H', '4H', '1D'] as const).map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setTimeFrame(tf)}
                    className={`px-3 py-1 text-xs font-medium rounded hover:bg-muted/50 ${
                      timeFrame === tf ? 'text-primary bg-muted/50' : 'text-muted-foreground'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
                <div className="h-4 w-px bg-border/50 mx-1" />
                <button
                  onClick={() => setChartType('line')}
                  className={`px-3 py-1 text-xs font-medium rounded hover:bg-muted/50 ${
                    chartType === 'line' ? 'text-primary bg-muted/50' : 'text-muted-foreground'
                  }`}
                >
                  Line
                </button>
                <button
                  onClick={() => setChartType('candle')}
                  className={`px-3 py-1 text-xs font-medium rounded hover:bg-muted/50 ${
                    chartType === 'candle' ? 'text-primary bg-muted/50' : 'text-muted-foreground'
                  }`}
                >
                  Candles
                </button>
              </div>
              <div className="flex-1 relative min-h-0">
                <div className="absolute inset-0">
                  <CandleStickChart 
                    data={priceHistory} 
                    colors={{
                      backgroundColor: '#161a25',
                      textColor: '#d1d5db',
                      lineColor: '#2962FF',
                      areaTopColor: '#2962FF',
                      areaBottomColor: 'rgba(41, 98, 255, 0.28)',
                    }}
                    height={0} // 0 means auto-fill parent height in our modified component logic
                  />
                </div>
              </div>
            </div>

            {/* Right Sidebar (30%) */}
            <div className="col-span-3 flex flex-col gap-1">
              {/* Order Book (Top Half) */}
              <div className="flex-1 bg-card/30 border border-border/50 rounded-sm overflow-hidden flex flex-col min-h-0">
                <div className="h-8 border-b border-border/50 px-3 flex items-center text-xs font-medium text-muted-foreground">
                  Order Book
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-border">
                  {/* Asks (Red) */}
                  <div className="flex flex-col-reverse gap-[1px]">
                    {orderBook.asks.slice(0, 12).map((ask, i) => (
                      <div key={i} className="grid grid-cols-3 text-[10px] hover:bg-muted/20 cursor-pointer relative group">
                        <div className="absolute inset-0 bg-[#f6465d]/10" style={{ width: `${Math.min(ask.amount, 100)}%`, right: 0, left: 'auto' }} />
                        <span className="text-[#f6465d] font-mono z-10 pl-1">{ask.price.toFixed(4)}</span>
                        <span className="text-right text-muted-foreground z-10">{ask.amount.toFixed(2)}</span>
                        <span className="text-right text-muted-foreground z-10 pr-1">{ask.total.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="py-2 border-y border-border/20 my-1 text-center">
                    <span className={`text-sm font-mono font-bold ${
                      marketStats.change24h >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'
                    }`}>
                      {currentPrice.toFixed(4)}
                    </span>
                  </div>

                  {/* Bids (Green) */}
                  <div className="flex flex-col gap-[1px]">
                    {orderBook.bids.slice(0, 12).map((bid, i) => (
                      <div key={i} className="grid grid-cols-3 text-[10px] hover:bg-muted/20 cursor-pointer relative group">
                        <div className="absolute inset-0 bg-[#0ecb81]/10" style={{ width: `${Math.min(bid.amount, 100)}%`, right: 0, left: 'auto' }} />
                        <span className="text-[#0ecb81] font-mono z-10 pl-1">{bid.price.toFixed(4)}</span>
                        <span className="text-right text-muted-foreground z-10">{bid.amount.toFixed(2)}</span>
                        <span className="text-right text-muted-foreground z-10 pr-1">{bid.total.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Depth Chart */}
                <div className="h-24 border-t border-border/50 bg-card/10">
                  <DepthChart bids={orderBook.bids} asks={orderBook.asks} height={96} />
                </div>
              </div>

              {/* Trading Panel (Bottom Half) */}
              <div className="h-[320px] bg-card/30 border border-border/50 rounded-sm overflow-hidden">
                <TradingPanel currentPrice={currentPrice} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Price Chart & Stats */}
      <div className="grid gap-6 md:grid-cols-3 items-stretch">
        <Card className="md:col-span-2 bg-card/50 border-muted flex flex-col">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap justify-between items-center gap-4">
              <CardTitle className="text-lg font-medium whitespace-nowrap">EDGE / USD</CardTitle>
              <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                <div className="flex bg-muted/50 rounded-lg p-1 gap-1">
                  {(['1H', '4H', '1D'] as const).map((tf) => (
                    <button
                      key={tf}
                      onClick={() => setTimeFrame(tf)}
                      className={`px-2 sm:px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                        timeFrame === tf 
                          ? 'bg-primary text-primary-foreground shadow-sm' 
                          : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
                <div className="flex bg-muted/50 rounded-lg p-1 gap-1">
                  <button
                    onClick={() => setChartType('line')}
                    className={`px-2 sm:px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                      chartType === 'line'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                    }`}
                  >
                    Line
                  </button>
                  <button
                    onClick={() => setChartType('candle')}
                    className={`px-2 sm:px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                      chartType === 'candle'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                    }`}
                  >
                    Candles
                  </button>
                </div>
                <div className="flex items-center gap-2 border-l border-border/50 pl-2 sm:pl-4">
                  <span className="text-xl sm:text-2xl font-bold">${currentPrice.toFixed(4)}</span>
                  <Badge variant={marketStats.change24h >= 0 ? "default" : "destructive"} className="flex items-center gap-1">
                    {marketStats.change24h >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingUp className="h-3 w-3 rotate-180" />}
                    {Math.abs(marketStats.change24h)}%
                  </Badge>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 min-h-[300px] p-0">
            <div className="h-full w-full">
              {chartType === 'candle' ? (
                <CandleStickChart 
                  data={priceHistory} 
                  maData={maData}
                  colors={{
                    backgroundColor: 'transparent',
                    textColor: '#9ca3af',
                  }}
                />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={priceHistory.map(d => ({
                    time: new Date((d.time as number) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    price: d.close
                  }))}>
                    <defs>
                      <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" hide />
                    <YAxis domain={['auto', 'auto']} hide />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                      itemStyle={{ color: '#e5e7eb' }}
                    />
                    <Area type="monotone" dataKey="price" stroke="#3b82f6" fillOpacity={1} fill="url(#colorPrice)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Order Book */}
        <Card className="bg-card/50 border-muted flex flex-col h-[400px] md:h-auto">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Order Book</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden flex flex-col gap-2 text-xs font-mono">
            <div className="flex justify-between text-muted-foreground pb-1 border-b border-border/50">
              <span>Price</span>
              <span>Amount</span>
              <span>Total</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1 scrollbar-hide">
              {/* Asks (Sells) - Red */}
              <div className="flex flex-col-reverse gap-1">
                {orderBook.asks.slice(0, 8).map((order, i) => (
                  <div key={`ask-${i}`} className="flex justify-between items-center hover:bg-red-500/10 px-1 rounded cursor-pointer">
                    <span className="text-red-400">{order.price.toFixed(4)}</span>
                    <span>{order.amount.toFixed(2)}</span>
                    <span className="text-muted-foreground">{order.total.toFixed(2)}</span>
                  </div>
                ))}
              </div>
              
              <div className="py-2 text-center font-bold text-lg border-y border-border/50 my-1">
                {currentPrice.toFixed(4)} <span className="text-xs text-muted-foreground font-normal">USD</span>
              </div>

              {/* Bids (Buys) - Green */}
              <div className="flex flex-col gap-1">
                {orderBook.bids.slice(0, 8).map((order, i) => (
                  <div key={`bid-${i}`} className="flex justify-between items-center hover:bg-green-500/10 px-1 rounded cursor-pointer">
                    <span className="text-green-400">{order.price.toFixed(4)}</span>
                    <span>{order.amount.toFixed(2)}</span>
                    <span className="text-muted-foreground">{order.total.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Depth Chart */}
            <div className="h-[100px] w-full mt-2 border-t border-border/50 pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={depthData}>
                  <defs>
                    <linearGradient id="colorBid" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorAsk" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="price" hide />
                  <YAxis hide />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', fontSize: '10px' }}
                    itemStyle={{ color: '#e5e7eb' }}
                    formatter={(value: number) => value.toFixed(2)}
                    labelFormatter={(label) => `Price: ${label}`}
                  />
                  <Area type="step" dataKey="bidDepth" stroke="#22c55e" fill="url(#colorBid)" strokeWidth={1} />
                  <Area type="step" dataKey="askDepth" stroke="#ef4444" fill="url(#colorAsk)" strokeWidth={1} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
