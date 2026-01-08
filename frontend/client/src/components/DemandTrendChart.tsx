import { useState, useEffect, Fragment } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface DataPoint {
  time: string;
  // Historical values (can be null for forecast points)
  Compute?: number;
  Storage?: number;
  IoT?: number;
  AI?: number;
  Sensor?: number;
  // Forecast values (can be null for historical points)
  ComputeForecast?: number;
  StorageForecast?: number;
  IoTForecast?: number;
  AIForecast?: number;
  SensorForecast?: number;
  isForecast?: boolean;
}

export function DemandTrendChart() {
  const [data, setData] = useState<DataPoint[]>([]);

  useEffect(() => {
    const generateData = () => {
      const now = new Date();
      const points: DataPoint[] = [];
      
      // 1. Generate Historical Data (Last 24 hours)
      // We store the last values to connect the forecast line
      let lastValues = {
        Compute: 0, Storage: 0, IoT: 0, AI: 0, Sensor: 0
      };

      for (let i = 24; i >= 0; i--) {
        const time = new Date(now.getTime() - i * 60 * 60 * 1000);
        const hour = time.getHours();
        const timeStr = `${hour.toString().padStart(2, '0')}:00`;
        
        const compute = Number((1.0 + Math.sin(i / 3) * 0.2 + Math.random() * 0.1).toFixed(2));
        const storage = Number((0.9 + Math.cos(i / 4) * 0.1 + Math.random() * 0.05).toFixed(2));
        const iot = Number((1.1 + Math.random() * 0.15).toFixed(2));
        const ai = Number((1.2 + Math.sin(i / 2) * 0.3 + Math.random() * 0.1).toFixed(2));
        const sensor = Number((1.0 + Math.random() * 0.1).toFixed(2));

        lastValues = { Compute: compute, Storage: storage, IoT: iot, AI: ai, Sensor: sensor };

        points.push({
          time: timeStr,
          Compute: compute,
          Storage: storage,
          IoT: iot,
          AI: ai,
          Sensor: sensor,
          isForecast: false
        });
      }

      // 2. Add the "Now" point to Forecast series as well to ensure connectivity
      // We modify the LAST point of the array to ALSO include Forecast start values
      const lastPointIndex = points.length - 1;
      points[lastPointIndex] = {
        ...points[lastPointIndex],
        ComputeForecast: lastValues.Compute,
        StorageForecast: lastValues.Storage,
        IoTForecast: lastValues.IoT,
        AIForecast: lastValues.AI,
        SensorForecast: lastValues.Sensor,
      };

      // 3. Generate Forecast Data (Next 4 hours)
      for (let i = 1; i <= 4; i++) {
        const time = new Date(now.getTime() + i * 60 * 60 * 1000);
        const hour = time.getHours();
        const timeStr = `${hour.toString().padStart(2, '0')}:00`;
        
        // Evolve from last values
        const compute = Number((lastValues.Compute + (Math.random() - 0.5) * 0.15).toFixed(2));
        const storage = Number((lastValues.Storage + (Math.random() - 0.5) * 0.08).toFixed(2));
        const iot = Number((lastValues.IoT + (Math.random() - 0.5) * 0.1).toFixed(2));
        const ai = Number((lastValues.AI + (Math.random() - 0.5) * 0.2).toFixed(2)); // AI is volatile
        const sensor = Number((lastValues.Sensor + (Math.random() - 0.5) * 0.08).toFixed(2));

        // Update last values for next iteration
        lastValues = { Compute: compute, Storage: storage, IoT: iot, AI: ai, Sensor: sensor };

        points.push({
          time: timeStr,
          // Historical fields are undefined here
          ComputeForecast: compute,
          StorageForecast: storage,
          IoTForecast: iot,
          AIForecast: ai,
          SensorForecast: sensor,
          isForecast: true
        });
      }

      return points;
    };

    setData(generateData());
  }, []);

  const metrics = [
    { key: 'Compute', color: '#3b82f6' },
    { key: 'Storage', color: '#10b981' },
    { key: 'IoT', color: '#f59e0b' },
    { key: 'AI', color: '#8b5cf6' },
    { key: 'Sensor', color: '#ec4899' },
  ];

  return (
    <Card className="w-full mb-6 bg-card/50 backdrop-blur-sm border-primary/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              Market Demand Multiplier Trend
              <Badge variant="outline" className="text-xs font-normal bg-primary/10 text-primary border-primary/20">
                24h History + 4h Forecast
              </Badge>
            </CardTitle>
            <CardDescription>
              Real-time demand multipliers (M_demand) with AI-powered predictive analysis.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
              <XAxis 
                dataKey="time" 
                stroke="#888888" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false}
                minTickGap={30}
              />
              <YAxis 
                stroke="#888888" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false}
                domain={[0.5, 1.8]}
                tickFormatter={(value) => `x${value}`}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(20, 20, 25, 0.9)', 
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
                itemStyle={{ padding: 0 }}
                formatter={(value: number, name: string, props: any) => {
                  // Clean up the name (remove 'Forecast' suffix for display)
                  const cleanName = name.replace('Forecast', '');
                  const isForecast = name.includes('Forecast');
                  return [`x${value}${isForecast ? ' (Est.)' : ''}`, cleanName];
                }}
                labelStyle={{ color: '#888888', marginBottom: '0.5rem' }}
              />
              <Legend wrapperStyle={{ paddingTop: '10px' }} />
              
              {/* Vertical line separating History and Forecast */}
              <ReferenceLine x={data[24]?.time} stroke="#666" strokeDasharray="3 3" label={{ position: 'top', value: 'NOW', fill: '#666', fontSize: 10 }} />

              {metrics.flatMap(({ key, color }) => [
                // Historical Line (Solid)
                <Line 
                  key={key}
                  type="monotone" 
                  dataKey={key} 
                  stroke={color} 
                  strokeWidth={2} 
                  dot={false} 
                  activeDot={{ r: 4 }}
                  name={key}
                  legendType="plainline" // Only show one legend item per metric
                />,
                // Forecast Line (Dashed)
                <Line 
                  key={`${key}Forecast`}
                  type="monotone" 
                  dataKey={`${key}Forecast`} 
                  stroke={color} 
                  strokeWidth={2} 
                  strokeDasharray="5 5" // Dashed effect
                  dot={false} 
                  activeDot={{ r: 4 }}
                  name={`${key}Forecast`}
                  legendType="none" // Hide from legend to avoid duplicates
                />
              ])}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
