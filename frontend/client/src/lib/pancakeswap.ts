// PancakeSwap Integration for EDGE/BNB trading pair
// This module fetches real-time data from PancakeSwap on BSC

const PANCAKESWAP_GRAPH_URL = 'https://proxy-worker-api.pancakeswap.com/bsc-exchange';
const DEXSCREENER_API = 'https://api.dexscreener.com/latest/dex';

// wEDGE token address on BSC (placeholder - will be updated after deployment)
export const WEDGE_ADDRESS = '0x0000000000000000000000000000000000000000'; // TODO: Update after deployment
export const WBNB_ADDRESS = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
export const PANCAKESWAP_ROUTER = '0x10ED43C718714eb63d5aA57B78B54704E256024E';

export interface PancakeSwapPair {
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceNative: string;
  priceUsd: string;
  volume24h: number;
  liquidity: number;
  priceChange24h: number;
  txns24h: {
    buys: number;
    sells: number;
  };
}

export interface OrderBookEntry {
  price: number;
  amount: number;
  total: number;
  type: 'buy' | 'sell';
}

export interface TradeHistory {
  timestamp: number;
  type: 'buy' | 'sell';
  price: number;
  amount: number;
  total: number;
  txHash: string;
}

// Simulated EDGE/BNB data (will be replaced with real data after wEDGE deployment)
export function getSimulatedEdgeBnbData(): PancakeSwapPair {
  const basePrice = 0.00015; // 0.00015 BNB per EDGE
  const bnbPrice = 600; // BNB price in USD
  const priceUsd = basePrice * bnbPrice;
  
  return {
    pairAddress: '0x0000000000000000000000000000000000000000',
    baseToken: {
      address: WEDGE_ADDRESS,
      name: 'Wrapped EDGE',
      symbol: 'wEDGE',
    },
    quoteToken: {
      address: WBNB_ADDRESS,
      name: 'Wrapped BNB',
      symbol: 'WBNB',
    },
    priceNative: basePrice.toString(),
    priceUsd: priceUsd.toFixed(6),
    volume24h: 125000 + Math.random() * 50000,
    liquidity: 500000 + Math.random() * 100000,
    priceChange24h: (Math.random() - 0.5) * 10,
    txns24h: {
      buys: Math.floor(150 + Math.random() * 100),
      sells: Math.floor(120 + Math.random() * 80),
    },
  };
}

// Generate simulated order book based on current price
export function generateOrderBook(currentPrice: number, depth: number = 15): {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
} {
  const bids: OrderBookEntry[] = [];
  const asks: OrderBookEntry[] = [];
  
  // Generate bids (buy orders) - prices below current
  for (let i = 0; i < depth; i++) {
    const priceOffset = (i + 1) * currentPrice * 0.002; // 0.2% increments
    const price = currentPrice - priceOffset;
    const amount = 1000 + Math.random() * 10000;
    bids.push({
      price,
      amount,
      total: price * amount,
      type: 'buy',
    });
  }
  
  // Generate asks (sell orders) - prices above current
  for (let i = 0; i < depth; i++) {
    const priceOffset = (i + 1) * currentPrice * 0.002;
    const price = currentPrice + priceOffset;
    const amount = 1000 + Math.random() * 10000;
    asks.push({
      price,
      amount,
      total: price * amount,
      type: 'sell',
    });
  }
  
  return {
    bids: bids.sort((a, b) => b.price - a.price),
    asks: asks.sort((a, b) => a.price - b.price),
  };
}

// Generate simulated trade history
export function generateTradeHistory(currentPrice: number, count: number = 50): TradeHistory[] {
  const trades: TradeHistory[] = [];
  const now = Date.now();
  
  let price = currentPrice;
  for (let i = 0; i < count; i++) {
    const type = Math.random() > 0.5 ? 'buy' : 'sell';
    const priceChange = (Math.random() - 0.5) * currentPrice * 0.01;
    price = price + priceChange;
    const amount = 100 + Math.random() * 5000;
    
    trades.push({
      timestamp: now - i * 30000, // 30 seconds apart
      type,
      price,
      amount,
      total: price * amount,
      txHash: `0x${Math.random().toString(16).slice(2, 10)}...`,
    });
  }
  
  return trades;
}

// Generate candlestick data for charts
export function generateCandlestickData(
  currentPrice: number,
  change24h: number,
  timeframe: '1H' | '4H' | '1D',
  points: number = 100
): Array<{
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}> {
  const data: Array<{
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }> = [];
  
  let interval = 60; // seconds
  let volatility = 0.002;
  
  switch (timeframe) {
    case '1H':
      interval = 60;
      volatility = 0.002;
      break;
    case '4H':
      interval = 240;
      volatility = 0.005;
      break;
    case '1D':
      interval = 3600;
      volatility = 0.01;
      break;
  }
  
  const now = Math.floor(Date.now() / 1000);
  const startPrice = currentPrice / (1 + change24h / 100);
  
  // Generate random walk with Brownian Bridge
  const randomWalk: number[] = [startPrice];
  let price = startPrice;
  
  for (let i = 1; i <= points; i++) {
    const change = (Math.random() - 0.5) * currentPrice * volatility;
    price += change;
    randomWalk.push(price);
  }
  
  // Apply Brownian Bridge to end at current price
  const finalPrice = randomWalk[points];
  const error = finalPrice - currentPrice;
  
  const bridgedPrices = randomWalk.map((p, i) => p - (i / points) * error);
  
  // Convert to OHLC
  for (let i = 0; i < points; i++) {
    const time = now - (points - 1 - i) * interval;
    const open = bridgedPrices[i];
    const close = bridgedPrices[i + 1];
    const bodyHigh = Math.max(open, close);
    const bodyLow = Math.min(open, close);
    const wickVol = currentPrice * volatility * 0.3;
    
    data.push({
      time,
      open,
      high: bodyHigh + Math.random() * wickVol,
      low: bodyLow - Math.random() * wickVol,
      close,
      volume: 10000 + Math.random() * 50000,
    });
  }
  
  return data;
}

// Format price for display
export function formatPrice(price: number): string {
  if (price < 0.00001) return price.toExponential(4);
  if (price < 0.001) return price.toFixed(8);
  if (price < 1) return price.toFixed(6);
  if (price < 100) return price.toFixed(4);
  return price.toFixed(2);
}

// Format large numbers
export function formatNumber(num: number): string {
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + 'B';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(2) + 'K';
  return num.toFixed(2);
}

// PancakeSwap swap URL generator
export function getPancakeSwapUrl(inputToken: string, outputToken: string): string {
  return `https://pancakeswap.finance/swap?inputCurrency=${inputToken}&outputCurrency=${outputToken}`;
}

// Get PancakeSwap add liquidity URL
export function getAddLiquidityUrl(token0: string, token1: string): string {
  return `https://pancakeswap.finance/add/${token0}/${token1}`;
}
