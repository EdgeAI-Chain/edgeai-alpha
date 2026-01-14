import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TrendingUp, TrendingDown, BarChart3, Maximize2, Minimize2, ExternalLink, ArrowDownUp, Droplets } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { CandleStickChart } from "@/components/CandleStickChart";
import { CandlestickData, Time } from 'lightweight-charts';
import { toast } from "sonner";
import {
  getSimulatedEdgeBnbData,
  generateOrderBook,
  generateTradeHistory,
  generateCandlestickData,
  formatPrice,
  formatNumber,
  getPancakeSwapUrl,
  getAddLiquidityUrl,
  WEDGE_ADDRESS,
  WBNB_ADDRESS,
  OrderBookEntry,
  TradeHistory,
  PancakeSwapPair,
} from "@/lib/pancakeswap";

export default function DEX() {
  const [pairData, setPairData] = useState<PancakeSwapPair | null>(null);
  const [orderBook, setOrderBook] = useState<{ bids: OrderBookEntry[], asks: OrderBookEntry[] }>({ bids: [], asks: [] });
  const [trades, setTrades] = useState<TradeHistory[]>([]);
  const [priceHistory, setPriceHistory] = useState<(CandlestickData<Time> & { volume: number })[]>([]);
  const [timeFrame, setTimeFrame] = useState<'1H' | '4H' | '1D'>('1H');
  const [chartType, setChartType] = useState<'line' | 'candle'>('candle');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Swap state
  const [swapDirection, setSwapDirection] = useState<'buy' | 'sell'>('buy');
  const [inputAmount, setInputAmount] = useState('');
  const [outputAmount, setOutputAmount] = useState('');

  // Toggle full screen mode
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullScreen(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  // Load initial data
  const loadData = useCallback(() => {
    const data = getSimulatedEdgeBnbData();
    setPairData(data);
    
    const price = parseFloat(data.priceUsd);
    setOrderBook(generateOrderBook(price));
    setTrades(generateTradeHistory(price));
    
    const candleData = generateCandlestickData(price, data.priceChange24h, timeFrame);
    setPriceHistory(candleData.map(d => ({
      time: d.time as Time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
      volume: d.volume,
    })));
    
    setLoading(false);
  }, [timeFrame]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [loadData]);

  // Calculate output amount when input changes
  useEffect(() => {
    if (!pairData || !inputAmount) {
      setOutputAmount('');
      return;
    }
    const input = parseFloat(inputAmount);
    if (isNaN(input)) return;
    
    const price = parseFloat(pairData.priceUsd);
    if (swapDirection === 'buy') {
      // Buying EDGE with BNB/USD
      setOutputAmount((input / price).toFixed(2));
    } else {
      // Selling EDGE for BNB/USD
      setOutputAmount((input * price).toFixed(6));
    }
  }, [inputAmount, swapDirection, pairData]);

  const handleSwapDirection = () => {
    setSwapDirection(prev => prev === 'buy' ? 'sell' : 'buy');
    setInputAmount('');
    setOutputAmount('');
  };

  const handleTrade = () => {
    if (!inputAmount || parseFloat(inputAmount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    
    // Open PancakeSwap in new tab
    const url = swapDirection === 'buy' 
      ? getPancakeSwapUrl(WBNB_ADDRESS, WEDGE_ADDRESS)
      : getPancakeSwapUrl(WEDGE_ADDRESS, WBNB_ADDRESS);
    
    window.open(url, '_blank');
    toast.info('Opening PancakeSwap...');
  };

  if (loading || !pairData) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const currentPrice = parseFloat(pairData.priceUsd);
  const priceChange = pairData.priceChange24h;
  const isPositive = priceChange >= 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-primary" />
            EDGE/BNB
          </h1>
          <p className="text-muted-foreground mt-1">
            Trade EDGE on PancakeSwap with shared liquidity
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2"
            onClick={() => window.open(getAddLiquidityUrl(WEDGE_ADDRESS, WBNB_ADDRESS), '_blank')}
          >
            <Droplets className="h-4 w-4" />
            Add Liquidity
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="hidden lg:flex gap-2"
            onClick={() => setIsFullScreen(true)}
          >
            <Maximize2 className="h-4 w-4" />
            Pro Mode
          </Button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card className="bg-card/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Price</p>
            <p className="text-xl font-bold font-mono">${formatPrice(currentPrice)}</p>
            <Badge variant={isPositive ? "default" : "destructive"} className="mt-1">
              {isPositive ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
              {isPositive ? '+' : ''}{priceChange.toFixed(2)}%
            </Badge>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">24h Volume</p>
            <p className="text-xl font-bold font-mono">${formatNumber(pairData.volume24h)}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Liquidity</p>
            <p className="text-xl font-bold font-mono">${formatNumber(pairData.liquidity)}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">24h Txns</p>
            <p className="text-xl font-bold font-mono">{pairData.txns24h.buys + pairData.txns24h.sells}</p>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-500">{pairData.txns24h.buys} buys</span> / 
              <span className="text-red-500"> {pairData.txns24h.sells} sells</span>
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Price (BNB)</p>
            <p className="text-xl font-bold font-mono">{parseFloat(pairData.priceNative).toFixed(8)}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">DEX</p>
            <div className="flex items-center gap-2 mt-1">
              <img src="https://pancakeswap.finance/favicon.ico" alt="PancakeSwap" className="w-5 h-5" />
              <span className="font-medium">PancakeSwap</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Full Screen Pro Mode */}
      {isFullScreen && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col overflow-hidden">
          <div className="h-12 border-b flex items-center justify-between px-4 bg-card/50">
            <div className="flex items-center gap-4">
              <span className="font-bold text-lg">EDGE/BNB</span>
              <span className="font-mono text-primary">${formatPrice(currentPrice)}</span>
              <Badge variant={isPositive ? "default" : "destructive"}>
                {isPositive ? '+' : ''}{priceChange.toFixed(2)}%
              </Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setIsFullScreen(false)}>
              <Minimize2 className="h-4 w-4 mr-2" />
              Exit
            </Button>
          </div>
          <div className="flex-1 p-2">
            <CandleStickChart 
              data={priceHistory}
              colors={{
                backgroundColor: '#0f0f0f',
                textColor: '#9ca3af',
              }}
            />
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <Card className="lg:col-span-2 bg-card/50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Price Chart</CardTitle>
              <div className="flex gap-2">
                {(['1H', '4H', '1D'] as const).map((tf) => (
                  <Button
                    key={tf}
                    variant={timeFrame === tf ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setTimeFrame(tf)}
                  >
                    {tf}
                  </Button>
                ))}
                <div className="w-px bg-border mx-1" />
                <Button
                  variant={chartType === 'line' ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setChartType('line')}
                >
                  Line
                </Button>
                <Button
                  variant={chartType === 'candle' ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setChartType('candle')}
                >
                  Candle
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="h-[400px] p-0">
            {chartType === 'candle' ? (
              <CandleStickChart 
                data={priceHistory}
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
                    formatter={(value: number) => ['$' + formatPrice(value), 'Price']}
                  />
                  <Area type="monotone" dataKey="price" stroke="#3b82f6" fillOpacity={1} fill="url(#colorPrice)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Swap Panel */}
        <Card className="bg-card/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ArrowDownUp className="h-5 w-5" />
              Swap
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Input */}
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">
                {swapDirection === 'buy' ? 'You Pay (USD)' : 'You Sell (EDGE)'}
              </label>
              <Input
                type="number"
                placeholder="0.00"
                value={inputAmount}
                onChange={(e) => setInputAmount(e.target.value)}
                className="text-lg font-mono"
              />
            </div>

            {/* Swap Direction Button */}
            <div className="flex justify-center">
              <Button variant="ghost" size="icon" onClick={handleSwapDirection}>
                <ArrowDownUp className="h-4 w-4" />
              </Button>
            </div>

            {/* Output */}
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">
                {swapDirection === 'buy' ? 'You Receive (EDGE)' : 'You Receive (USD)'}
              </label>
              <Input
                type="text"
                placeholder="0.00"
                value={outputAmount}
                readOnly
                className="text-lg font-mono bg-muted"
              />
            </div>

            {/* Price Info */}
            <div className="text-sm text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>Rate</span>
                <span className="font-mono">1 EDGE = ${formatPrice(currentPrice)}</span>
              </div>
              <div className="flex justify-between">
                <span>Slippage</span>
                <span className="font-mono">0.5%</span>
              </div>
            </div>

            {/* Trade Button */}
            <Button className="w-full gap-2" size="lg" onClick={handleTrade}>
              <ExternalLink className="h-4 w-4" />
              Trade on PancakeSwap
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Trades are executed on PancakeSwap DEX
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Order Book & Recent Trades */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Order Book */}
        <Card className="bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Order Book</CardTitle>
          </CardHeader>
          <CardContent className="text-xs font-mono">
            <div className="flex justify-between text-muted-foreground pb-2 border-b">
              <span>Price (USD)</span>
              <span>Amount (EDGE)</span>
              <span>Total (USD)</span>
            </div>
            <div className="max-h-[200px] overflow-y-auto">
              {/* Asks */}
              <div className="flex flex-col-reverse">
                {orderBook.asks.slice(0, 8).map((order, i) => (
                  <div key={`ask-${i}`} className="flex justify-between py-1 hover:bg-red-500/10">
                    <span className="text-red-400">{formatPrice(order.price)}</span>
                    <span>{order.amount.toFixed(2)}</span>
                    <span className="text-muted-foreground">{formatNumber(order.total)}</span>
                  </div>
                ))}
              </div>
              
              {/* Current Price */}
              <div className="py-2 text-center font-bold text-lg border-y my-1">
                ${formatPrice(currentPrice)}
              </div>

              {/* Bids */}
              <div>
                {orderBook.bids.slice(0, 8).map((order, i) => (
                  <div key={`bid-${i}`} className="flex justify-between py-1 hover:bg-green-500/10">
                    <span className="text-green-400">{formatPrice(order.price)}</span>
                    <span>{order.amount.toFixed(2)}</span>
                    <span className="text-muted-foreground">{formatNumber(order.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Trades */}
        <Card className="bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Recent Trades</CardTitle>
          </CardHeader>
          <CardContent className="text-xs font-mono">
            <div className="flex justify-between text-muted-foreground pb-2 border-b">
              <span>Price (USD)</span>
              <span>Amount (EDGE)</span>
              <span>Time</span>
            </div>
            <div className="max-h-[200px] overflow-y-auto">
              {trades.slice(0, 20).map((trade, i) => (
                <div key={i} className="flex justify-between py-1">
                  <span className={trade.type === 'buy' ? 'text-green-400' : 'text-red-400'}>
                    {formatPrice(trade.price)}
                  </span>
                  <span>{trade.amount.toFixed(2)}</span>
                  <span className="text-muted-foreground">
                    {new Date(trade.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* PancakeSwap Info */}
      <Card className="bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border-amber-500/20">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="https://pancakeswap.finance/favicon.ico" alt="PancakeSwap" className="w-8 h-8" />
            <div>
              <p className="font-medium">Powered by PancakeSwap</p>
              <p className="text-sm text-muted-foreground">Trade EDGE with deep liquidity on BSC</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            className="gap-2"
            onClick={() => window.open(getPancakeSwapUrl(WBNB_ADDRESS, WEDGE_ADDRESS), '_blank')}
          >
            <ExternalLink className="h-4 w-4" />
            Open PancakeSwap
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
