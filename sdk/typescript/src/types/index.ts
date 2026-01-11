/**
 * EdgeAI Blockchain SDK Type Definitions
 * @packageDocumentation
 */

// ============================================================================
// Core Types
// ============================================================================

/**
 * Configuration options for the EdgeAI client
 */
export interface EdgeAIConfig {
  /** Base URL of the EdgeAI node API */
  baseUrl: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** API key for authenticated requests (optional) */
  apiKey?: string;
  /** Enable debug logging (default: false) */
  debug?: boolean;
}

/**
 * Blockchain network information
 */
export interface NetworkInfo {
  /** Network name (e.g., "mainnet", "testnet") */
  name: string;
  /** Chain ID */
  chainId: number;
  /** Current block height */
  height: number;
  /** Network version */
  version: string;
}

// ============================================================================
// Block Types
// ============================================================================

/**
 * Block header information
 */
export interface BlockHeader {
  /** Block version */
  version: number;
  /** Hash of the previous block */
  previousHash: string;
  /** Merkle root of transactions */
  merkleRoot: string;
  /** Block timestamp (ISO 8601 format) */
  timestamp: string;
  /** Mining difficulty */
  difficulty: number;
  /** Block nonce */
  nonce: number;
  /** Data entropy (PoIE metric) */
  dataEntropy: number;
}

/**
 * Complete block data
 */
export interface Block {
  /** Block index/height */
  index: number;
  /** Block header */
  header: BlockHeader;
  /** List of transactions in the block */
  transactions: Transaction[];
  /** Block hash */
  hash: string;
  /** Validator address */
  validator: string;
}

/**
 * Simplified block summary
 */
export interface BlockSummary {
  /** Block index/height */
  index: number;
  /** Block hash */
  hash: string;
  /** Block timestamp */
  timestamp: string;
  /** Number of transactions */
  transactionCount: number;
  /** Validator address */
  validator: string;
}

// ============================================================================
// Transaction Types
// ============================================================================

/**
 * Transaction types supported by EdgeAI
 */
export enum TransactionType {
  /** Standard token transfer */
  Transfer = 'Transfer',
  /** IoT data submission */
  DataSubmission = 'DataSubmission',
  /** Smart contract deployment */
  ContractDeploy = 'ContractDeploy',
  /** Smart contract call */
  ContractCall = 'ContractCall',
  /** Staking operation */
  Stake = 'Stake',
  /** Unstaking operation */
  Unstake = 'Unstake',
  /** Delegation operation */
  Delegate = 'Delegate',
  /** Claim rewards */
  ClaimRewards = 'ClaimRewards',
}

/**
 * Transaction data
 */
export interface Transaction {
  /** Transaction hash */
  hash: string;
  /** Transaction type */
  type: TransactionType;
  /** Sender address */
  from: string;
  /** Recipient address */
  to: string;
  /** Amount transferred (in smallest unit) */
  amount: string;
  /** Transaction fee */
  fee: string;
  /** Transaction nonce */
  nonce: number;
  /** Transaction timestamp */
  timestamp: string;
  /** Transaction signature */
  signature: string;
  /** Additional data payload */
  data?: string;
  /** Block index (if confirmed) */
  blockIndex?: number;
  /** Transaction status */
  status: TransactionStatus;
}

/**
 * Transaction status
 */
export enum TransactionStatus {
  /** Transaction is pending in mempool */
  Pending = 'pending',
  /** Transaction is confirmed in a block */
  Confirmed = 'confirmed',
  /** Transaction failed */
  Failed = 'failed',
}

/**
 * Transaction receipt
 */
export interface TransactionReceipt {
  /** Transaction hash */
  transactionHash: string;
  /** Block index */
  blockIndex: number;
  /** Block hash */
  blockHash: string;
  /** Gas used */
  gasUsed: string;
  /** Transaction status */
  status: TransactionStatus;
  /** Contract address (if deployment) */
  contractAddress?: string;
  /** Logs/events emitted */
  logs: TransactionLog[];
}

/**
 * Transaction log/event
 */
export interface TransactionLog {
  /** Log index */
  index: number;
  /** Contract address */
  address: string;
  /** Event topics */
  topics: string[];
  /** Event data */
  data: string;
}

/**
 * Parameters for creating a transfer transaction
 */
export interface TransferParams {
  /** Recipient address */
  to: string;
  /** Amount to transfer */
  amount: string;
  /** Optional memo/data */
  memo?: string;
}

// ============================================================================
// Account Types
// ============================================================================

/**
 * Account information
 */
export interface Account {
  /** Account address */
  address: string;
  /** Account balance */
  balance: string;
  /** Account nonce */
  nonce: number;
  /** Staked amount */
  stakedAmount: string;
  /** Delegated amount */
  delegatedAmount: string;
  /** Pending rewards */
  pendingRewards: string;
}

/**
 * Account balance breakdown
 */
export interface AccountBalance {
  /** Available balance */
  available: string;
  /** Staked balance */
  staked: string;
  /** Delegated balance */
  delegated: string;
  /** Unbonding balance */
  unbonding: string;
  /** Pending rewards */
  rewards: string;
  /** Total balance */
  total: string;
}

// ============================================================================
// Staking Types
// ============================================================================

/**
 * Validator status
 */
export enum ValidatorStatus {
  /** Validator is active and producing blocks */
  Active = 'Active',
  /** Validator is inactive */
  Inactive = 'Inactive',
  /** Validator is jailed for misbehavior */
  Jailed = 'Jailed',
  /** Validator is unbonding */
  Unbonding = 'Unbonding',
}

/**
 * Validator information
 */
export interface Validator {
  /** Validator address */
  address: string;
  /** Validator name */
  name: string;
  /** Validator description */
  description: string;
  /** Website URL */
  website?: string;
  /** Total staked amount */
  totalStake: string;
  /** Self-bonded amount */
  selfStake: string;
  /** Delegated amount */
  delegatedStake: string;
  /** Commission rate (0-1) */
  commission: number;
  /** Validator status */
  status: ValidatorStatus;
  /** Uptime percentage */
  uptime: number;
  /** Number of blocks produced */
  blocksProduced: number;
  /** Voting power percentage */
  votingPower: number;
}

/**
 * Delegation information
 */
export interface Delegation {
  /** Delegator address */
  delegator: string;
  /** Validator address */
  validator: string;
  /** Delegated amount */
  amount: string;
  /** Pending rewards */
  rewards: string;
  /** Delegation start time */
  startTime: string;
}

/**
 * Unbonding entry
 */
export interface UnbondingEntry {
  /** Validator address */
  validator: string;
  /** Amount unbonding */
  amount: string;
  /** Completion time */
  completionTime: string;
}

/**
 * Staking statistics
 */
export interface StakingStats {
  /** Total validators */
  totalValidators: number;
  /** Active validators */
  activeValidators: number;
  /** Total staked amount */
  totalStaked: string;
  /** Total delegated amount */
  totalDelegated: string;
  /** Average commission rate */
  averageCommission: number;
  /** Current APY */
  currentApy: number;
}

/**
 * Parameters for staking
 */
export interface StakeParams {
  /** Amount to stake */
  amount: string;
  /** Validator name (optional) */
  validatorName?: string;
  /** Validator description (optional) */
  validatorDescription?: string;
  /** Commission rate (0-0.25) */
  commission?: number;
}

/**
 * Parameters for delegation
 */
export interface DelegateParams {
  /** Validator address to delegate to */
  validator: string;
  /** Amount to delegate */
  amount: string;
}

// ============================================================================
// Smart Contract Types
// ============================================================================

/**
 * Smart contract information
 */
export interface Contract {
  /** Contract address */
  address: string;
  /** Contract creator */
  creator: string;
  /** Contract code hash */
  codeHash: string;
  /** Deployment timestamp */
  deployedAt: string;
  /** Contract ABI */
  abi?: ContractAbi;
}

/**
 * Contract ABI (Application Binary Interface)
 */
export interface ContractAbi {
  /** Contract functions */
  functions: AbiFunction[];
  /** Contract events */
  events: AbiEvent[];
}

/**
 * ABI function definition
 */
export interface AbiFunction {
  /** Function name */
  name: string;
  /** Function parameters */
  inputs: AbiParam[];
  /** Function outputs */
  outputs: AbiParam[];
  /** Whether function is read-only */
  readonly: boolean;
}

/**
 * ABI event definition
 */
export interface AbiEvent {
  /** Event name */
  name: string;
  /** Event parameters */
  inputs: AbiParam[];
}

/**
 * ABI parameter
 */
export interface AbiParam {
  /** Parameter name */
  name: string;
  /** Parameter type */
  type: string;
  /** Whether parameter is indexed (for events) */
  indexed?: boolean;
}

/**
 * Contract deployment parameters
 */
export interface DeployContractParams {
  /** WASM bytecode (hex encoded) */
  code: string;
  /** Constructor arguments */
  args?: unknown[];
  /** Gas limit */
  gasLimit?: string;
}

/**
 * Contract call parameters
 */
export interface CallContractParams {
  /** Contract address */
  contract: string;
  /** Function name */
  function: string;
  /** Function arguments */
  args?: unknown[];
  /** Amount to send with call */
  value?: string;
  /** Gas limit */
  gasLimit?: string;
}

/**
 * Contract call result
 */
export interface ContractCallResult {
  /** Return value */
  result: unknown;
  /** Gas used */
  gasUsed: string;
  /** Logs emitted */
  logs: TransactionLog[];
}

// ============================================================================
// Device/IoT Types
// ============================================================================

/**
 * Device types supported by EdgeAI
 */
export enum DeviceType {
  /** Generic sensor */
  Sensor = 'Sensor',
  /** Medical device */
  Medical = 'Medical',
  /** Industrial equipment */
  Industrial = 'Industrial',
  /** Smart home device */
  SmartHome = 'SmartHome',
  /** Autonomous vehicle */
  Vehicle = 'Vehicle',
  /** Weather station */
  Weather = 'Weather',
  /** Energy meter */
  Energy = 'Energy',
  /** Agricultural sensor */
  Agriculture = 'Agriculture',
}

/**
 * Device information
 */
export interface Device {
  /** Device ID */
  id: string;
  /** Device owner address */
  owner: string;
  /** Device type */
  deviceType: DeviceType;
  /** Device name */
  name: string;
  /** Geographic region */
  region: string;
  /** Reputation score (0-100) */
  reputation: number;
  /** Total data contributions */
  contributions: number;
  /** Registration timestamp */
  registeredAt: string;
  /** Last active timestamp */
  lastActive: string;
  /** Whether device is active */
  isActive: boolean;
}

/**
 * Device registration parameters
 */
export interface RegisterDeviceParams {
  /** Device type */
  deviceType: DeviceType;
  /** Device name */
  name: string;
  /** Geographic region */
  region: string;
  /** Device metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Data submission parameters
 */
export interface SubmitDataParams {
  /** Device ID */
  deviceId: string;
  /** Data type identifier */
  dataType: string;
  /** Data payload */
  data: unknown;
  /** Data timestamp */
  timestamp?: string;
}

/**
 * Device statistics
 */
export interface DeviceStats {
  /** Total registered devices */
  totalDevices: number;
  /** Active devices */
  activeDevices: number;
  /** Average reputation */
  averageReputation: number;
  /** Regions covered */
  regionsCovered: number;
}

// ============================================================================
// Chain Statistics Types
// ============================================================================

/**
 * Chain statistics
 */
export interface ChainStats {
  /** Current block height */
  height: number;
  /** Total transactions */
  totalTransactions: number;
  /** Active accounts */
  activeAccounts: number;
  /** Network entropy */
  networkEntropy: number;
  /** Transactions per second */
  tps: number;
}

/**
 * Mempool statistics
 */
export interface MempoolStats {
  /** Number of pending transactions */
  pendingCount: number;
  /** Total pending amount */
  pendingAmount: string;
  /** Average fee */
  averageFee: string;
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T> {
  /** Whether the request was successful */
  success: boolean;
  /** Response data */
  data?: T;
  /** Error message (if failed) */
  error?: string;
  /** Error code (if failed) */
  errorCode?: string;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  /** Items in current page */
  items: T[];
  /** Total number of items */
  total: number;
  /** Current page number */
  page: number;
  /** Items per page */
  pageSize: number;
  /** Whether there are more pages */
  hasMore: boolean;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  /** Page number (1-indexed) */
  page?: number;
  /** Items per page */
  pageSize?: number;
  /** Allow additional properties for API compatibility */
  [key: string]: unknown;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * SDK event types
 */
export enum EdgeAIEvent {
  /** New block received */
  NewBlock = 'newBlock',
  /** New transaction received */
  NewTransaction = 'newTransaction',
  /** Connection established */
  Connected = 'connected',
  /** Connection lost */
  Disconnected = 'disconnected',
  /** Error occurred */
  Error = 'error',
}

/**
 * Event callback type
 */
export type EventCallback<T = unknown> = (data: T) => void;
