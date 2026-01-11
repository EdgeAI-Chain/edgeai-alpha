import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger 
} from "@/components/ui/dialog";
import { 
  Coins, 
  TrendingUp, 
  Users, 
  Shield, 
  Clock, 
  ArrowUpRight, 
  ArrowDownRight,
  Wallet,
  Gift,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Info
} from "lucide-react";
import { cn } from "@/lib/utils";

// Types
interface StakingStats {
  totalStaked: string;
  totalDelegated: string;
  totalValidators: number;
  activeValidators: number;
  averageApy: number;
  unbondingPeriod: number;
}

interface Validator {
  address: string;
  name: string;
  description: string;
  totalStake: string;
  selfStake: string;
  delegatedStake: string;
  commission: number;
  status: "Active" | "Inactive" | "Jailed" | "Unbonding";
  uptime: number;
  votingPower: number;
}

interface Delegation {
  validator: string;
  validatorName: string;
  amount: string;
  rewards: string;
  startTime: string;
}

interface UnbondingEntry {
  validator: string;
  validatorName: string;
  amount: string;
  completionTime: string;
}

// Mock API functions (replace with real API calls)
const fetchStakingStats = async (): Promise<StakingStats> => {
  // Simulated API response
  return {
    totalStaked: "125000000000000000000000000",
    totalDelegated: "89000000000000000000000000",
    totalValidators: 156,
    activeValidators: 142,
    averageApy: 12.5,
    unbondingPeriod: 7,
  };
};

const fetchValidators = async (): Promise<Validator[]> => {
  // Simulated validators
  return [
    {
      address: "0x1234567890abcdef1234567890abcdef12345678",
      name: "EdgeAI Foundation",
      description: "Official foundation validator node",
      totalStake: "15000000000000000000000000",
      selfStake: "10000000000000000000000000",
      delegatedStake: "5000000000000000000000000",
      commission: 5,
      status: "Active",
      uptime: 99.98,
      votingPower: 12.5,
    },
    {
      address: "0xabcdef1234567890abcdef1234567890abcdef12",
      name: "IoT Network Hub",
      description: "High-performance edge computing node",
      totalStake: "12000000000000000000000000",
      selfStake: "8000000000000000000000000",
      delegatedStake: "4000000000000000000000000",
      commission: 8,
      status: "Active",
      uptime: 99.95,
      votingPower: 10.2,
    },
    {
      address: "0x9876543210fedcba9876543210fedcba98765432",
      name: "DataStream Validator",
      description: "Specialized in medical IoT data",
      totalStake: "9500000000000000000000000",
      selfStake: "6000000000000000000000000",
      delegatedStake: "3500000000000000000000000",
      commission: 10,
      status: "Active",
      uptime: 99.92,
      votingPower: 8.1,
    },
    {
      address: "0xfedcba9876543210fedcba9876543210fedcba98",
      name: "Smart City Node",
      description: "Urban infrastructure data processing",
      totalStake: "8200000000000000000000000",
      selfStake: "5500000000000000000000000",
      delegatedStake: "2700000000000000000000000",
      commission: 7,
      status: "Active",
      uptime: 99.88,
      votingPower: 7.0,
    },
    {
      address: "0x1111222233334444555566667777888899990000",
      name: "Green Energy Validator",
      description: "Renewable energy monitoring network",
      totalStake: "7100000000000000000000000",
      selfStake: "4800000000000000000000000",
      delegatedStake: "2300000000000000000000000",
      commission: 6,
      status: "Active",
      uptime: 99.85,
      votingPower: 6.1,
    },
  ];
};

const fetchMyDelegations = async (): Promise<Delegation[]> => {
  return [
    {
      validator: "0x1234567890abcdef1234567890abcdef12345678",
      validatorName: "EdgeAI Foundation",
      amount: "5000000000000000000000",
      rewards: "125000000000000000000",
      startTime: "2025-12-01T00:00:00Z",
    },
  ];
};

const fetchMyUnbonding = async (): Promise<UnbondingEntry[]> => {
  return [];
};

// Utility functions
const formatEdge = (amount: string, decimals: number = 2): string => {
  const value = BigInt(amount);
  const edge = Number(value) / 1e18;
  if (edge >= 1000000) {
    return (edge / 1000000).toFixed(decimals) + "M";
  } else if (edge >= 1000) {
    return (edge / 1000).toFixed(decimals) + "K";
  }
  return edge.toFixed(decimals);
};

const shortenAddress = (address: string): string => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export default function Staking() {
  const [stats, setStats] = useState<StakingStats | null>(null);
  const [validators, setValidators] = useState<Validator[]>([]);
  const [myDelegations, setMyDelegations] = useState<Delegation[]>([]);
  const [myUnbonding, setMyUnbonding] = useState<UnbondingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedValidator, setSelectedValidator] = useState<Validator | null>(null);
  const [delegateAmount, setDelegateAmount] = useState("");
  const [undelegateAmount, setUndelegateAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState("validators");

  // Mock wallet state (replace with real wallet connection)
  const [walletConnected] = useState(true);
  const [walletBalance] = useState("10000000000000000000000"); // 10,000 EDGE

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [statsData, validatorsData, delegationsData, unbondingData] = await Promise.all([
          fetchStakingStats(),
          fetchValidators(),
          fetchMyDelegations(),
          fetchMyUnbonding(),
        ]);
        setStats(statsData);
        setValidators(validatorsData);
        setMyDelegations(delegationsData);
        setMyUnbonding(unbondingData);
      } catch (error) {
        console.error("Failed to load staking data:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleDelegate = async () => {
    if (!selectedValidator || !delegateAmount) return;
    setIsProcessing(true);
    // Simulate transaction
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsProcessing(false);
    setDelegateAmount("");
    // Refresh data
  };

  const handleUndelegate = async () => {
    if (!selectedValidator || !undelegateAmount) return;
    setIsProcessing(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsProcessing(false);
    setUndelegateAmount("");
  };

  const handleClaimRewards = async () => {
    setIsProcessing(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsProcessing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active": return "bg-green-500/10 text-green-500 border-green-500/20";
      case "Inactive": return "bg-gray-500/10 text-gray-500 border-gray-500/20";
      case "Jailed": return "bg-red-500/10 text-red-500 border-red-500/20";
      case "Unbonding": return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      default: return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    }
  };

  const totalRewards = myDelegations.reduce((acc, d) => acc + BigInt(d.rewards), BigInt(0));
  const totalDelegated = myDelegations.reduce((acc, d) => acc + BigInt(d.amount), BigInt(0));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Coins className="h-8 w-8 text-primary" />
            Staking
          </h1>
          <p className="text-muted-foreground mt-1">
            Stake EDGE tokens to secure the network and earn rewards.
          </p>
        </div>
        {!walletConnected && (
          <Button>
            <Wallet className="h-4 w-4 mr-2" />
            Connect Wallet
          </Button>
        )}
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-card/50 border-muted">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Coins className="h-4 w-4" />
              Total Staked
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats ? formatEdge(stats.totalStaked) : "0"} EDGE</div>
            <p className="text-xs text-muted-foreground mt-1">
              Network security value
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-muted">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Average APY
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{stats?.averageApy || 0}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              Estimated annual yield
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-muted">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Active Validators
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeValidators || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              of {stats?.totalValidators || 0} total validators
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-muted">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Unbonding Period
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.unbondingPeriod || 7} Days</div>
            <p className="text-xs text-muted-foreground mt-1">
              Time to unlock staked tokens
            </p>
          </CardContent>
        </Card>
      </div>

      {/* My Staking Summary */}
      {walletConnected && (
        <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              My Staking
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-4">
              <div>
                <p className="text-sm text-muted-foreground">Available Balance</p>
                <p className="text-xl font-bold">{formatEdge(walletBalance)} EDGE</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Delegated</p>
                <p className="text-xl font-bold">{formatEdge(totalDelegated.toString())} EDGE</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Rewards</p>
                <p className="text-xl font-bold text-green-500">{formatEdge(totalRewards.toString())} EDGE</p>
              </div>
              <div className="flex items-end">
                <Button 
                  onClick={handleClaimRewards} 
                  disabled={totalRewards === BigInt(0) || isProcessing}
                  className="w-full"
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Gift className="h-4 w-4 mr-2" />
                  )}
                  Claim Rewards
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
          <TabsTrigger value="validators">Validators</TabsTrigger>
          <TabsTrigger value="delegations">My Delegations</TabsTrigger>
          <TabsTrigger value="unbonding">Unbonding</TabsTrigger>
        </TabsList>

        {/* Validators Tab */}
        <TabsContent value="validators" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Validators</CardTitle>
              <CardDescription>
                Select a validator to delegate your EDGE tokens and earn rewards.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {validators.map((validator) => (
                  <div
                    key={validator.address}
                    className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-lg border bg-card/50 hover:bg-card/80 transition-colors gap-4"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-primary" />
                        <span className="font-semibold">{validator.name}</span>
                        <Badge variant="outline" className={getStatusColor(validator.status)}>
                          {validator.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{validator.description}</p>
                      <div className="flex flex-wrap gap-4 mt-2 text-sm">
                        <span className="text-muted-foreground">
                          Stake: <span className="text-foreground font-medium">{formatEdge(validator.totalStake)} EDGE</span>
                        </span>
                        <span className="text-muted-foreground">
                          Commission: <span className="text-foreground font-medium">{validator.commission}%</span>
                        </span>
                        <span className="text-muted-foreground">
                          Uptime: <span className="text-green-500 font-medium">{validator.uptime}%</span>
                        </span>
                        <span className="text-muted-foreground">
                          Voting Power: <span className="text-foreground font-medium">{validator.votingPower}%</span>
                        </span>
                      </div>
                    </div>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          onClick={() => setSelectedValidator(validator)}
                        >
                          <ArrowUpRight className="h-4 w-4 mr-2" />
                          Delegate
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Delegate to {validator.name}</DialogTitle>
                          <DialogDescription>
                            Enter the amount of EDGE tokens you want to delegate to this validator.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label>Amount (EDGE)</Label>
                            <Input
                              type="number"
                              placeholder="0.00"
                              value={delegateAmount}
                              onChange={(e) => setDelegateAmount(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                              Available: {formatEdge(walletBalance)} EDGE
                            </p>
                          </div>
                          <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                            <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5" />
                            <div className="text-sm">
                              <p className="font-medium text-yellow-500">Important</p>
                              <p className="text-muted-foreground">
                                Delegated tokens have a {stats?.unbondingPeriod || 7}-day unbonding period.
                                Commission rate: {validator.commission}%
                              </p>
                            </div>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button 
                            onClick={handleDelegate} 
                            disabled={!delegateAmount || isProcessing}
                          >
                            {isProcessing ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                            )}
                            Confirm Delegation
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* My Delegations Tab */}
        <TabsContent value="delegations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>My Delegations</CardTitle>
              <CardDescription>
                Manage your active delegations and claim rewards.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {myDelegations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Coins className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>You haven't delegated any tokens yet.</p>
                  <p className="text-sm mt-1">Select a validator from the Validators tab to start earning rewards.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {myDelegations.map((delegation, index) => (
                    <div
                      key={index}
                      className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-lg border bg-card/50 gap-4"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Shield className="h-5 w-5 text-primary" />
                          <span className="font-semibold">{delegation.validatorName}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {shortenAddress(delegation.validator)}
                        </p>
                        <div className="flex flex-wrap gap-4 mt-2 text-sm">
                          <span className="text-muted-foreground">
                            Delegated: <span className="text-foreground font-medium">{formatEdge(delegation.amount)} EDGE</span>
                          </span>
                          <span className="text-muted-foreground">
                            Rewards: <span className="text-green-500 font-medium">{formatEdge(delegation.rewards)} EDGE</span>
                          </span>
                          <span className="text-muted-foreground">
                            Since: <span className="text-foreground font-medium">
                              {new Date(delegation.startTime).toLocaleDateString()}
                            </span>
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline">
                              <ArrowDownRight className="h-4 w-4 mr-2" />
                              Undelegate
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Undelegate from {delegation.validatorName}</DialogTitle>
                              <DialogDescription>
                                Enter the amount of EDGE tokens you want to undelegate.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div className="space-y-2">
                                <Label>Amount (EDGE)</Label>
                                <Input
                                  type="number"
                                  placeholder="0.00"
                                  value={undelegateAmount}
                                  onChange={(e) => setUndelegateAmount(e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">
                                  Delegated: {formatEdge(delegation.amount)} EDGE
                                </p>
                              </div>
                              <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                                <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5" />
                                <div className="text-sm">
                                  <p className="font-medium text-yellow-500">Unbonding Period</p>
                                  <p className="text-muted-foreground">
                                    Undelegated tokens will be available after {stats?.unbondingPeriod || 7} days.
                                  </p>
                                </div>
                              </div>
                            </div>
                            <DialogFooter>
                              <Button 
                                onClick={handleUndelegate} 
                                disabled={!undelegateAmount || isProcessing}
                                variant="destructive"
                              >
                                {isProcessing ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <ArrowDownRight className="h-4 w-4 mr-2" />
                                )}
                                Confirm Undelegation
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Unbonding Tab */}
        <TabsContent value="unbonding" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Unbonding Tokens</CardTitle>
              <CardDescription>
                Tokens that are currently in the unbonding period.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {myUnbonding.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No tokens are currently unbonding.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {myUnbonding.map((entry, index) => {
                    const completionDate = new Date(entry.completionTime);
                    const now = new Date();
                    const totalDays = stats?.unbondingPeriod || 7;
                    const daysRemaining = Math.max(0, Math.ceil((completionDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
                    const progress = ((totalDays - daysRemaining) / totalDays) * 100;

                    return (
                      <div
                        key={index}
                        className="p-4 rounded-lg border bg-card/50"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Shield className="h-5 w-5 text-muted-foreground" />
                            <span className="font-semibold">{entry.validatorName}</span>
                          </div>
                          <span className="text-lg font-bold">{formatEdge(entry.amount)} EDGE</span>
                        </div>
                        <Progress value={progress} className="h-2 mb-2" />
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>{daysRemaining} days remaining</span>
                          <span>Available: {completionDate.toLocaleDateString()}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Info Card */}
      <Card className="bg-card/50 border-muted">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Info className="h-5 w-5" />
            About Staking
          </CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none">
          <p className="text-muted-foreground">
            Staking EDGE tokens helps secure the EdgeAI network through the Proof of Information Entropy (PoIE) consensus mechanism. 
            By delegating your tokens to validators, you contribute to network security and earn rewards proportional to your stake.
          </p>
          <div className="grid md:grid-cols-3 gap-4 mt-4">
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <h4 className="font-medium text-green-500 mb-1">Earn Rewards</h4>
              <p className="text-sm text-muted-foreground">
                Earn up to {stats?.averageApy || 12}% APY by delegating to active validators.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <h4 className="font-medium text-blue-500 mb-1">Secure the Network</h4>
              <p className="text-sm text-muted-foreground">
                Your stake helps validators process IoT data and maintain consensus.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <h4 className="font-medium text-purple-500 mb-1">Participate in Governance</h4>
              <p className="text-sm text-muted-foreground">
                Stakers can vote on protocol upgrades and network parameters.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
