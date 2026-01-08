import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Wallet, ArrowRightLeft } from "lucide-react";

interface TradingPanelProps {
  currentPrice: number;
  balance?: {
    usd: number;
    edge: number;
  };
}

export function TradingPanel({ currentPrice, balance = { usd: 12500.00, edge: 0 } }: TradingPanelProps) {
  const [orderType, setOrderType] = useState<'limit' | 'market'>('limit');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [price, setPrice] = useState<string>(currentPrice.toFixed(4));
  const [amount, setAmount] = useState<string>('');
  const [sliderValue, setSliderValue] = useState([0]);

  // Update price when currentPrice changes if in limit mode and price field is empty or untouched
  // In a real app, we might want more complex logic here
  
  const handleSliderChange = (value: number[]) => {
    setSliderValue(value);
    const percentage = value[0] / 100;
    
    if (side === 'buy') {
      // Calculate max buy amount based on USD balance
      const maxBuy = balance.usd / (parseFloat(price) || currentPrice);
      setAmount((maxBuy * percentage).toFixed(2));
    } else {
      // Calculate max sell amount based on EDGE balance
      const maxSell = balance.edge;
      setAmount((maxSell * percentage).toFixed(2));
    }
  };

  const total = (parseFloat(price) || 0) * (parseFloat(amount) || 0);

  return (
    <Card className="h-full bg-card/50 border-muted flex flex-col">
      <CardHeader className="pb-2 px-4 pt-4">
        <div className="flex justify-between items-center">
          <CardTitle className="text-sm font-medium">Spot Trading</CardTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Wallet className="h-3 w-3" />
            <span>
              {side === 'buy' 
                ? `${balance.usd.toLocaleString()} USD` 
                : `${balance.edge.toLocaleString()} EDGE`}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 px-4 pb-4 space-y-4">
        <Tabs defaultValue="buy" className="w-full" onValueChange={(v) => setSide(v as 'buy' | 'sell')}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger 
              value="buy" 
              className="data-[state=active]:bg-[#0ecb81] data-[state=active]:text-white"
            >
              Buy
            </TabsTrigger>
            <TabsTrigger 
              value="sell" 
              className="data-[state=active]:bg-[#f6465d] data-[state=active]:text-white"
            >
              Sell
            </TabsTrigger>
          </TabsList>

          <div className="flex gap-2 mb-4">
            <Button 
              variant={orderType === 'limit' ? 'secondary' : 'ghost'} 
              size="sm" 
              className="flex-1 h-7 text-xs"
              onClick={() => setOrderType('limit')}
            >
              Limit
            </Button>
            <Button 
              variant={orderType === 'market' ? 'secondary' : 'ghost'} 
              size="sm" 
              className="flex-1 h-7 text-xs"
              onClick={() => setOrderType('market')}
            >
              Market
            </Button>
          </div>

          <div className="space-y-3">
            {orderType === 'limit' && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Price</span>
                  <span>USD</span>
                </div>
                <div className="relative">
                  <Input 
                    type="number" 
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="pr-12 text-right font-mono"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    USD
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Amount</span>
                <span>EDGE</span>
              </div>
              <div className="relative">
                <Input 
                  type="number" 
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pr-12 text-right font-mono"
                  placeholder="0.00"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  EDGE
                </span>
              </div>
            </div>

            <div className="py-2">
              <Slider 
                value={sliderValue} 
                onValueChange={handleSliderChange}
                max={100} 
                step={1}
                className="cursor-pointer"
              />
              <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
                <span>0%</span>
                <span>25%</span>
                <span>50%</span>
                <span>75%</span>
                <span>100%</span>
              </div>
            </div>

            {orderType === 'limit' && (
              <div className="flex justify-between items-center text-xs py-1">
                <span className="text-muted-foreground">Total</span>
                <span className="font-mono">{total.toFixed(2)} USD</span>
              </div>
            )}

            <Button 
              className={`w-full font-bold ${
                side === 'buy' 
                  ? 'bg-[#0ecb81] hover:bg-[#0ecb81]/90' 
                  : 'bg-[#f6465d] hover:bg-[#f6465d]/90'
              }`}
            >
              {side === 'buy' ? 'Buy EDGE' : 'Sell EDGE'}
            </Button>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}
