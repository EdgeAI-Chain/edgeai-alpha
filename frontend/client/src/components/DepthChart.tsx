import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useTheme } from "@/components/theme-provider";

interface DepthChartProps {
  bids: { price: number; amount: number; total: number }[];
  asks: { price: number; amount: number; total: number }[];
  height?: number;
}

export const DepthChart = ({ bids, asks, height = 200 }: DepthChartProps) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  // Prepare data for Recharts
  // We need a single array with sorted prices
  // Bids are sorted descending (highest price first), Asks are sorted ascending (lowest price first)
  
  // Reverse bids to have lowest price first for the chart (left to right)
  const sortedBids = [...bids].sort((a, b) => a.price - b.price);
  const sortedAsks = [...asks].sort((a, b) => a.price - b.price);

  const data = [
    ...sortedBids.map(b => ({
      price: b.price,
      bidVolume: b.total, // Cumulative total
      askVolume: null,
    })),
    ...sortedAsks.map(a => ({
      price: a.price,
      bidVolume: null,
      askVolume: a.total, // Cumulative total
    }))
  ];

  return (
    <div style={{ height: height, width: '100%' }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorBid" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0ecb81" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#0ecb81" stopOpacity={0.05}/>
            </linearGradient>
            <linearGradient id="colorAsk" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f6465d" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#f6465d" stopOpacity={0.05}/>
            </linearGradient>
          </defs>
          <XAxis 
            dataKey="price" 
            type="number" 
            domain={['auto', 'auto']} 
            tickFormatter={(val) => val.toFixed(4)}
            hide
          />
          <YAxis hide />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: isDark ? '#1e222d' : '#ffffff', 
              borderColor: isDark ? '#2a2e39' : '#e5e7eb', 
              color: isDark ? '#d1d5db' : '#374151' 
            }}
            itemStyle={{ fontSize: '12px' }}
            labelStyle={{ color: isDark ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}
            formatter={(value: number, name: string) => [
              value.toFixed(2), 
              name === 'bidVolume' ? 'Bid Depth' : 'Ask Depth'
            ]}
            labelFormatter={(label) => `Price: ${Number(label).toFixed(4)}`}
          />
          <Area 
            type="stepAfter" 
            dataKey="bidVolume" 
            stroke="#0ecb81" 
            fill="url(#colorBid)" 
            strokeWidth={2}
            isAnimationActive={false}
          />
          <Area 
            type="stepBefore" 
            dataKey="askVolume" 
            stroke="#f6465d" 
            fill="url(#colorAsk)" 
            strokeWidth={2}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
