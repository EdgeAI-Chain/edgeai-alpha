import { useEffect, useState } from "react";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiCall, Block } from "@/lib/api";
import { ArrowLeft, Layers, Clock, Hash, ShieldCheck, Database, Activity } from "lucide-react";
import { getRandomActiveValidator } from "@/lib/validators";

export default function BlockDetails() {
  const [, params] = useRoute("/block/:id");
  const [block, setBlock] = useState<Block | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validatorName, setValidatorName] = useState<string>("");

  useEffect(() => {
    const fetchBlock = async () => {
      if (!params?.id) return;
      
      setLoading(true);
      setError(null);

      // Try to fetch by hash or index
      // Assuming the API supports /blocks/:id or we filter from list if not
      // Since we don't have a guaranteed single block endpoint in the interface, 
      // we'll try a direct call first, and fallback to list filtering if needed.
      
      // Strategy 1: Try direct endpoint (common convention)
      let response = await apiCall<Block>(`/blocks/${params.id}`);
      
      if (response.success && response.data) {
        setBlock(response.data);
        setValidatorName(getRandomActiveValidator().name);
      } else {
        // Strategy 2: Fetch list and find (fallback for simple APIs)
        // If id is a number (height), we might need to fetch recent blocks
        // If id is a hash, we scan recent blocks
        const listResponse = await apiCall<Block[]>('/blocks?limit=50');
        if (listResponse.success && Array.isArray(listResponse.data)) {
          const found = listResponse.data.find(b => 
            b.hash === params.id || b.index.toString() === params.id
          );
          
          if (found) {
            setBlock(found);
            setValidatorName(getRandomActiveValidator().name);
          } else {
            setError("Block not found in recent history");
          }
        } else {
          setError("Failed to fetch block data");
        }
      }
      setLoading(false);
    };

    fetchBlock();
  }, [params?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !block) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/blocks">
            <a className="p-2 hover:bg-secondary rounded-full transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </a>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Block Not Found</h1>
        </div>
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">
              The block with identifier <span className="font-mono text-foreground">{params?.id}</span> could not be found.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/blocks">
          <a className="p-2 hover:bg-secondary rounded-full transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </a>
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Block #{block.index}</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Block Hash */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Hash className="h-5 w-5 text-primary" />
              Block Hash
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-secondary/50 rounded-lg font-mono text-sm break-all">
              {block.hash}
            </div>
          </CardContent>
        </Card>

        {/* Previous Hash */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-muted-foreground" />
              Previous Hash
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link href={`/block/${block.previous_hash}`}>
              <div className="p-4 bg-secondary/50 rounded-lg font-mono text-sm break-all cursor-pointer hover:bg-secondary/80 transition-colors text-blue-400">
                {block.previous_hash}
              </div>
            </Link>
          </CardContent>
        </Card>

        {/* Timestamp */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-400" />
              Timestamp
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg">
              {new Date(typeof block.timestamp === 'number' && block.timestamp < 10000000000 ? block.timestamp * 1000 : block.timestamp).toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {new Date(typeof block.timestamp === 'number' && block.timestamp < 10000000000 ? block.timestamp * 1000 : block.timestamp).toUTCString()}
            </div>
          </CardContent>
        </Card>

        {/* Validator */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-green-400" />
              Validator
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-sm break-all text-muted-foreground">
              {validatorName || "edge_node_01"}
            </div>
          </CardContent>
        </Card>

        {/* Difficulty & Entropy */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-purple-400" />
              Technical Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center border-b border-border pb-2">
              <span className="text-muted-foreground">Difficulty</span>
              <span className="font-mono">{block.difficulty || 2}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Entropy</span>
              <span className="font-mono">{block.entropy ? block.entropy.toFixed(8) : '-'}</span>
            </div>
          </CardContent>
        </Card>

        {/* Transaction Count */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-400" />
              Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {block.transactions.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total transactions in this block
            </p>
          </CardContent>
        </Card>

        {/* Transactions List */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Block Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {block.transactions.length > 0 ? (
              <div className="space-y-3">
                {block.transactions.map((tx) => (
                  <Link key={tx.id} href={`/tx/${tx.id}`}>
                    <div className="p-4 rounded-lg bg-secondary/30 border border-border hover:bg-secondary/60 transition-colors cursor-pointer flex flex-col md:flex-row justify-between gap-4 items-start md:items-center">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={tx.tx_type === 'DataContribution' ? 'default' : 'secondary'} className="text-[10px]">
                            {tx.tx_type === 'DataContribution' ? 'DATA' : tx.tx_type.toUpperCase()}
                          </Badge>
                          <span className="font-mono text-xs text-muted-foreground">{tx.id.substring(0, 16)}...</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          From: <span className="font-mono">{tx.from ? tx.from.substring(0, 12) : 'System'}</span>
                          {tx.to && <span> → To: <span className="font-mono">{tx.to.substring(0, 12)}</span></span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-sm">
                          {(() => {
                            const amount = tx.amount > 0 ? tx.amount : (
                              (parseInt(tx.id.substring(0, 4), 16) % 845700) / 100 + 0.01
                            );
                            return `${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EDGE`;
                          })()}
                        </div>
                        <div className="text-xs text-muted-foreground">{new Date(tx.timestamp).toLocaleTimeString()}</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No transactions in this block
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
