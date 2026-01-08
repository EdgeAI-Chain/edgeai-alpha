import { createChart, ColorType, IChartApi, ISeriesApi, CandlestickData, Time, CandlestickSeries, HistogramSeries, HistogramData, LineSeries, LineData } from 'lightweight-charts';
import { useEffect, useRef, useState } from 'react';
import { useTheme } from "@/components/theme-provider";

interface CandleStickChartProps {
  data: (CandlestickData<Time> & { volume?: number, color?: string })[];
  maData?: {
    ma7: LineData<Time>[];
    ma25: LineData<Time>[];
    ma99: LineData<Time>[];
  };
  colors?: {
    backgroundColor?: string;
    lineColor?: string;
    textColor?: string;
    areaTopColor?: string;
    areaBottomColor?: string;
  };
  height?: number;
}

export const CandleStickChart = (props: CandleStickChartProps) => {
    const {
    data,
    maData,
    height = 300,
    colors: {
      backgroundColor = 'transparent',
      textColor = '#9ca3af',
    } = {},
  } = props;

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const ma7SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ma25SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ma99SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const [legendData, setLegendData] = useState<any>(null);
  const { theme } = useTheme();

  // Determine colors based on theme
  const isDark = theme === 'dark';
  const chartBgColor = isDark ? 'transparent' : '#ffffff';
  const chartTextColor = isDark ? '#9ca3af' : '#4b5563';
  const gridColor = isDark ? 'rgba(42, 46, 57, 0.05)' : 'rgba(42, 46, 57, 0.08)';
  const borderColor = isDark ? 'rgba(197, 203, 206, 0.1)' : 'rgba(197, 203, 206, 0.3)';

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ 
          width: chartContainerRef.current.clientWidth,
          height: height || chartContainerRef.current.clientHeight
        });
      }
    };

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: chartBgColor },
        textColor: chartTextColor,
      },
      width: chartContainerRef.current.clientWidth,
      height: height || chartContainerRef.current.clientHeight,
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      rightPriceScale: {
        borderColor: borderColor,
        scaleMargins: {
          top: 0.1,
          bottom: 0.2,
        },
        borderVisible: false,
      },
      timeScale: {
        borderColor: borderColor,
        timeVisible: true,
        secondsVisible: false,
        borderVisible: false,
        barSpacing: 6, // Increased spacing for better readability
        minBarSpacing: 4,
      },
      crosshair: {
        mode: 1, // CrosshairMode.Normal
        vertLine: {
          width: 1,
          color: borderColor,
          style: 0,
        },
        horzLine: {
          width: 1,
          color: borderColor,
          style: 0,
        },
      },
    });

    chartRef.current = chart;

    // Volume Series
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#26a69a',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '', // Set as an overlay by setting a blank priceScaleId
    });
    
    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8, // Highest volume bar will be 80% down the chart
        bottom: 0,
      },
    });
    volumeSeriesRef.current = volumeSeries;

    // Candlestick Series
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#0ecb81',
      downColor: '#f6465d',
      borderVisible: false,
      wickUpColor: '#0ecb81',
      wickDownColor: '#f6465d',
      priceFormat: {
        type: 'price',
        precision: 4,
        minMove: 0.0001,
      },
    });
    candlestickSeries.setData(data);
    seriesRef.current = candlestickSeries;

    // MA Series
    if (maData) {
      const ma7Series = chart.addSeries(LineSeries, {
        color: '#F59E0B', // Amber/Yellow
        lineWidth: 1,
        priceScaleId: 'right',
        crosshairMarkerVisible: false,
      });
      ma7Series.setData(maData.ma7);
      ma7SeriesRef.current = ma7Series;

      const ma25Series = chart.addSeries(LineSeries, {
        color: '#8B5CF6', // Violet
        lineWidth: 1,
        priceScaleId: 'right',
        crosshairMarkerVisible: false,
      });
      ma25Series.setData(maData.ma25);
      ma25SeriesRef.current = ma25Series;

      const ma99Series = chart.addSeries(LineSeries, {
        color: '#3B82F6', // Blue
        lineWidth: 1,
        priceScaleId: 'right',
        crosshairMarkerVisible: false,
      });
      ma99Series.setData(maData.ma99);
      ma99SeriesRef.current = ma99Series;
    }

    // Set initial data
    const volumeData = data.map(d => ({
      time: d.time,
      value: d.volume || 0,
      color: (d.close > d.open) ? 'rgba(14, 203, 129, 0.3)' : 'rgba(246, 70, 93, 0.3)',
    }));
    
    candlestickSeries.setData(data);
    volumeSeries.setData(volumeData);

    // Subscribe to crosshair move for legend
    chart.subscribeCrosshairMove(param => {
      if (
        param.point === undefined ||
        !param.time ||
        param.point.x < 0 ||
        param.point.x > chartContainerRef.current!.clientWidth ||
        param.point.y < 0 ||
        param.point.y > chartContainerRef.current!.clientHeight
      ) {
        setLegendData(null);
      } else {
        const candleData = param.seriesData.get(candlestickSeries) as any;
        const volData = param.seriesData.get(volumeSeries) as any;
        
        // Get MA values if series exist
        const ma7Data = ma7SeriesRef.current ? param.seriesData.get(ma7SeriesRef.current) as any : null;
        const ma25Data = ma25SeriesRef.current ? param.seriesData.get(ma25SeriesRef.current) as any : null;
        const ma99Data = ma99SeriesRef.current ? param.seriesData.get(ma99SeriesRef.current) as any : null;

        if (candleData) {
          setLegendData({
            open: candleData.open,
            high: candleData.high,
            low: candleData.low,
            close: candleData.close,
            volume: volData?.value,
            change: ((candleData.close - candleData.open) / candleData.open) * 100,
            ma7: ma7Data?.value,
            ma25: ma25Data?.value,
            ma99: ma99Data?.value,
          });
        }
      }
    });

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [backgroundColor, textColor, theme]);

  useEffect(() => {
    if (seriesRef.current && volumeSeriesRef.current) {
      seriesRef.current.setData(data);
      
      const volumeData = data.map(d => ({
        time: d.time,
        value: d.volume || 0,
        color: (d.close > d.open) ? 'rgba(14, 203, 129, 0.3)' : 'rgba(246, 70, 93, 0.3)',
      }));
      volumeSeriesRef.current.setData(volumeData);
    }
  }, [data]);

  return (
    <div className="relative w-full h-full">
      {legendData && (
        <div className="absolute top-2 left-2 z-10 flex gap-3 text-xs font-mono pointer-events-none bg-background/50 backdrop-blur-sm p-1 rounded border border-border/20">
          <div className="flex gap-1">
            <span className="text-muted-foreground">O</span>
            <span className={legendData.change >= 0 ? "text-[#0ecb81]" : "text-[#f6465d]"}>{legendData.open.toFixed(4)}</span>
          </div>
          <div className="flex gap-1">
            <span className="text-muted-foreground">H</span>
            <span className={legendData.change >= 0 ? "text-[#0ecb81]" : "text-[#f6465d]"}>{legendData.high.toFixed(4)}</span>
          </div>
          <div className="flex gap-1">
            <span className="text-muted-foreground">L</span>
            <span className={legendData.change >= 0 ? "text-[#0ecb81]" : "text-[#f6465d]"}>{legendData.low.toFixed(4)}</span>
          </div>
          <div className="flex gap-1">
            <span className="text-muted-foreground">C</span>
            <span className={legendData.change >= 0 ? "text-[#0ecb81]" : "text-[#f6465d]"}>{legendData.close.toFixed(4)}</span>
          </div>
          {legendData.volume && (
            <div className="flex gap-1">
              <span className="text-muted-foreground">V</span>
              <span className="text-foreground">{Math.round(legendData.volume).toLocaleString()}</span>
            </div>
          )}
          <div className="flex gap-1">
            <span className={legendData.change >= 0 ? "text-[#0ecb81]" : "text-[#f6465d]"}>
              {legendData.change >= 0 ? '+' : ''}{legendData.change.toFixed(2)}%
            </span>
          </div>
          
          {/* MA Legend */}
          {legendData.ma7 && (
            <div className="flex gap-1 border-l border-border/20 pl-2 ml-1">
              <span className="text-[#F59E0B]">MA7</span>
              <span className="text-[#F59E0B]">{legendData.ma7.toFixed(4)}</span>
            </div>
          )}
          {legendData.ma25 && (
            <div className="flex gap-1">
              <span className="text-[#8B5CF6]">MA25</span>
              <span className="text-[#8B5CF6]">{legendData.ma25.toFixed(4)}</span>
            </div>
          )}
          {legendData.ma99 && (
            <div className="flex gap-1">
              <span className="text-[#3B82F6]">MA99</span>
              <span className="text-[#3B82F6]">{legendData.ma99.toFixed(4)}</span>
            </div>
          )}
        </div>
      )}
      <div 
        ref={chartContainerRef} 
        className="w-full h-full"
      />
    </div>
  );
};
