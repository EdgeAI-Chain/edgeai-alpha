import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QrCode, Building2, Factory, Leaf, HeartPulse, Truck, Zap, ChevronLeft, ChevronRight, ArrowRightLeft } from "lucide-react";
import QRCode from "react-qr-code";
import { getIoTTransactions, IoTTransaction } from "@/lib/iotGenerator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function Transactions() {
  const [transactions, setTransactions] = useState<IoTTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [sectorFilter, setSectorFilter] = useState<string | null>(null);
  const pageSize = 20;
  const totalTransactions = 100000;

  useEffect(() => {
    // Simulate fetching IoT transactions
    setLoading(true);
    // Small delay to simulate network request
    const timer = setTimeout(() => {
      const data = getIoTTransactions(page, pageSize);
      setTransactions(data);
      setLoading(false);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [page]);

  const filteredTransactions = transactions.filter(tx => {
    const matchesSector = sectorFilter ? tx.sector === sectorFilter : true;
    return matchesSector;
  });

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Global IoT Transactions</h1>
        <div className="flex gap-2">
          <div className="flex flex-wrap gap-1 bg-secondary/30 p-1 rounded-md">
            <Button 
              variant={sectorFilter === null ? "secondary" : "ghost"} 
              size="sm" 
              onClick={() => setSectorFilter(null)}
              className="text-xs h-7"
            >
              All
            </Button>
            <Button 
              variant={sectorFilter === 'Smart City' ? "secondary" : "ghost"} 
              size="sm" 
              onClick={() => setSectorFilter('Smart City')}
              className="text-xs h-7 gap-1"
            >
              <Building2 className="h-3 w-3" /> City
            </Button>
            <Button 
              variant={sectorFilter === 'Industrial IoT' ? "secondary" : "ghost"} 
              size="sm" 
              onClick={() => setSectorFilter('Industrial IoT')}
              className="text-xs h-7 gap-1"
            >
              <Factory className="h-3 w-3" /> Industry
            </Button>
            <Button 
              variant={sectorFilter === 'Smart Agriculture' ? "secondary" : "ghost"} 
              size="sm" 
              onClick={() => setSectorFilter('Smart Agriculture')}
              className="text-xs h-7 gap-1"
            >
              <Leaf className="h-3 w-3" /> Agri
            </Button>
            <Button 
              variant={sectorFilter === 'Healthcare' ? "secondary" : "ghost"} 
              size="sm" 
              onClick={() => setSectorFilter('Healthcare')}
              className="text-xs h-7 gap-1"
            >
              <HeartPulse className="h-3 w-3" /> Health
            </Button>
            <Button 
              variant={sectorFilter === 'Logistics' ? "secondary" : "ghost"} 
              size="sm" 
              onClick={() => setSectorFilter('Logistics')}
              className="text-xs h-7 gap-1"
            >
              <Truck className="h-3 w-3" /> Logistics
            </Button>
            <Button 
              variant={sectorFilter === 'Energy Grid' ? "secondary" : "ghost"} 
              size="sm" 
              onClick={() => setSectorFilter('Energy Grid')}
              className="text-xs h-7 gap-1"
            >
              <Zap className="h-3 w-3" /> Energy
            </Button>
          </div>
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <span>Live Data Stream</span>
            <Badge variant="outline" className="font-mono">Total: {totalTransactions.toLocaleString()}+</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative w-full">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-auto">
            <table className="w-full caption-bottom text-sm">
              <thead className="[&_tr]:border-b">
                <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Tx Hash</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Sector</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Device</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Location</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Payload Preview</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Amount</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Time</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[50px]"></th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {loading ? (
                  <tr><td colSpan={8} className="p-4 text-center">Loading IoT Data Stream...</td></tr>
                ) : filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="border-b transition-colors hover:bg-muted/50">
                    <td className="p-4 align-middle font-mono text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <span className="truncate max-w-[120px]" title={tx.id}>
                          {tx.id.substring(0, 12)}...
                        </span>
                      </div>
                    </td>
                    <td className="p-4 align-middle">
                      <div className="flex items-center gap-2">
                        {getSectorIcon(tx.sector)}
                        <span className="text-xs hidden md:inline">{tx.sector}</span>
                      </div>
                    </td>
                    <td className="p-4 align-middle text-xs">
                      {tx.deviceType}
                    </td>
                    <td className="p-4 align-middle text-xs text-muted-foreground">
                      {tx.location}
                    </td>
                    <td className="p-4 align-middle font-mono text-[10px] text-muted-foreground max-w-[150px] truncate" title={tx.dataPayload}>
                      {tx.dataPayload}
                    </td>
                    <td className="p-4 align-middle">
                      <span className="font-medium text-green-400 text-xs">
                        {tx.amount.toFixed(4)} EDGE
                      </span>
                    </td>
                    <td className="p-4 align-middle text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(tx.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="p-4 align-middle">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            <QrCode className="h-3 w-3" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle>Transaction QR Code</DialogTitle>
                          </DialogHeader>
                          <div className="flex flex-col items-center justify-center p-6 space-y-4">
                            <div className="bg-white p-4 rounded-lg">
                              <QRCode 
                                value={`${window.location.origin}/tx/${tx.id}`} 
                                size={200} 
                              />
                            </div>
                            <p className="text-xs text-muted-foreground font-mono break-all text-center">
                              {tx.id}
                            </p>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {loading ? (
                <div className="p-4 text-center text-muted-foreground">Loading IoT Data Stream...</div>
              ) : filteredTransactions.map((tx) => (
                <div key={tx.id} className="p-4 border rounded-lg bg-card/50 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      {getSectorIcon(tx.sector)}
                      <span className="font-medium text-sm">{tx.sector}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{new Date(tx.timestamp).toLocaleTimeString()}</span>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Tx Hash:</span>
                      <span className="font-mono" title={tx.id}>{tx.id.substring(0, 12)}...</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Device:</span>
                      <span>{tx.deviceType}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Location:</span>
                      <span>{tx.location}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-border/50">
                    <span className="font-medium text-green-400 text-sm">
                      {tx.amount.toFixed(4)} EDGE
                    </span>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <QrCode className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>Transaction QR Code</DialogTitle>
                        </DialogHeader>
                        <div className="flex flex-col items-center justify-center p-6 space-y-4">
                          <div className="bg-white p-4 rounded-lg">
                            <QRCode 
                              value={`${window.location.origin}/tx/${tx.id}`} 
                              size={200} 
                            />
                          </div>
                          <p className="text-xs text-muted-foreground font-mono break-all text-center">
                            {tx.id}
                          </p>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
        <div className="flex items-center justify-between p-4 border-t border-border">
          <div className="text-sm text-muted-foreground">
            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, totalTransactions)} of {totalTransactions.toLocaleString()} transactions
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Previous
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setPage(p => p + 1)}
              disabled={page * pageSize >= totalTransactions}
            >
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
