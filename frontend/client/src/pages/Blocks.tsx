import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiCall, Block } from "@/lib/api";
import { Copy, QrCode } from "lucide-react";
import { toast } from "sonner";
import QRCode from "react-qr-code";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function Blocks() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const LIMIT = 20;

  const fetchBlocks = async (isLoadMore = false) => {
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    const currentOffset = isLoadMore ? blocks.length : 0;
    const response = await apiCall<Block[]>(`/blocks?limit=${LIMIT}&offset=${currentOffset}`);
    
    if (response.success && Array.isArray(response.data)) {
      // Use backend data directly without any timestamp manipulation
      const backendBlocks = response.data;

      if (isLoadMore) {
        setBlocks(prev => [...prev, ...backendBlocks]);
      } else {
        setBlocks(backendBlocks);
      }
    }
    
    setLoading(false);
    setLoadingMore(false);
  };

  useEffect(() => {
    fetchBlocks();
    // Poll every 10 seconds to get new blocks from backend
    const interval = setInterval(() => fetchBlocks(false), 10000);
    return () => clearInterval(interval);
  }, []);

  const handleLoadMore = () => {
    fetchBlocks(true);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Hash copied to clipboard");
  };

  // Format timestamp from backend
  const formatTimestamp = (timestamp: number | string) => {
    let ts: number;
    if (typeof timestamp === 'number') {
      // Backend returns seconds, convert to milliseconds if needed
      ts = timestamp < 10000000000 ? timestamp * 1000 : timestamp;
    } else {
      ts = new Date(timestamp).getTime();
    }
    
    const date = new Date(ts);
    if (isNaN(date.getTime())) {
      return "N/A";
    }
    
    return date.toLocaleTimeString(undefined, {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Blocks</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Latest Blocks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative w-full overflow-auto">
            <table className="w-full caption-bottom text-sm">
              <thead className="[&_tr]:border-b">
                <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Index</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Hash</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Txns</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Validator</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Entropy</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Time</th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {loading ? (
                  <tr><td colSpan={6} className="p-4 text-center">Loading...</td></tr>
                ) : blocks.map((block) => (
                  <tr key={block.hash} className="border-b transition-colors hover:bg-muted/50">
                    <td className="p-4 align-middle font-medium text-primary">
                      <Link href={`/block/${block.hash}`} className="hover:underline">
                        #{block.index}
                      </Link>
                    </td>
                    <td className="p-4 align-middle font-mono text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Link href={`/block/${block.hash}`} className="hover:text-foreground transition-colors truncate max-w-[150px]" title={block.hash}>
                          {block.hash.substring(0, 20)}...
                        </Link>
                        <button 
                          onClick={() => copyToClipboard(block.hash)}
                          className="p-1 hover:bg-secondary rounded-md transition-colors text-muted-foreground hover:text-foreground"
                          title="Copy full hash"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                        <Dialog>
                          <DialogTrigger asChild>
                            <button 
                              className="p-1 hover:bg-secondary rounded-md transition-colors text-muted-foreground hover:text-foreground"
                              title="Show QR Code"
                            >
                              <QrCode className="h-3 w-3" />
                            </button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                              <DialogTitle>Block Hash QR Code</DialogTitle>
                            </DialogHeader>
                            <div className="flex flex-col items-center justify-center p-6 space-y-4">
                              <div className="bg-white p-4 rounded-lg">
                                <QRCode 
                                  value={`${window.location.origin}/block/${block.hash}`} 
                                  size={200} 
                                />
                              </div>
                              <p className="text-xs text-muted-foreground font-mono break-all text-center">
                                {block.hash}
                              </p>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </td>
                    <td className="p-4 align-middle">{block.transactions.length}</td>
                    <td className="p-4 align-middle font-mono text-xs">
                      {block.validator || "N/A"}
                    </td>
                    <td className="p-4 align-middle font-mono text-xs">
                      {block.entropy ? block.entropy.toFixed(4) : "N/A"}
                    </td>
                    <td className="p-4 align-middle text-muted-foreground font-mono text-xs">
                      {formatTimestamp(block.timestamp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t border-border flex justify-center">
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors disabled:opacity-50"
            >
              {loadingMore ? 'Loading...' : 'Load More Blocks'}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
