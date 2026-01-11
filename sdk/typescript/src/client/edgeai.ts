/**
 * EdgeAI Blockchain SDK Client
 * @packageDocumentation
 */

import EventEmitter from 'eventemitter3';
import { HttpClient } from './http';
import {
  EdgeAIConfig,
  EdgeAIEvent,
  EventCallback,
  // Chain types
  ChainStats,
  NetworkInfo,
  MempoolStats,
  // Block types
  Block,
  BlockSummary,
  // Transaction types
  Transaction,
  TransactionReceipt,
  TransferParams,
  // Account types
  Account,
  AccountBalance,
  // Staking types
  Validator,
  Delegation,
  UnbondingEntry,
  StakingStats,
  StakeParams,
  DelegateParams,
  // Contract types
  Contract,
  DeployContractParams,
  CallContractParams,
  ContractCallResult,
  // Device types
  Device,
  DeviceStats,
  RegisterDeviceParams,
  SubmitDataParams,
  // Pagination
  PaginatedResponse,
  PaginationParams,
} from '../types';

/**
 * Main EdgeAI SDK Client
 *
 * @example
 * ```typescript
 * import { EdgeAIClient } from '@edgeai/sdk';
 *
 * const client = new EdgeAIClient({
 *   baseUrl: 'https://edgeai-blockchain-node.fly.dev',
 * });
 *
 * // Get chain stats
 * const stats = await client.getChainStats();
 * console.log(`Current height: ${stats.height}`);
 *
 * // Get account balance
 * const balance = await client.getAccountBalance('0x...');
 * console.log(`Balance: ${balance.available}`);
 * ```
 */
export class EdgeAIClient extends EventEmitter {
  private readonly http: HttpClient;
  private readonly config: EdgeAIConfig;

  /**
   * Create a new EdgeAI client
   * @param config - Client configuration
   */
  constructor(config: EdgeAIConfig) {
    super();
    this.config = config;
    this.http = new HttpClient(config);
  }

  // ============================================================================
  // Chain Methods
  // ============================================================================

  /**
   * Get current chain statistics
   * @returns Chain statistics
   */
  async getChainStats(): Promise<ChainStats> {
    return this.http.get<ChainStats>('/api/chain');
  }

  /**
   * Get network information
   * @returns Network information
   */
  async getNetworkInfo(): Promise<NetworkInfo> {
    return this.http.get<NetworkInfo>('/api/network');
  }

  /**
   * Get mempool statistics
   * @returns Mempool statistics
   */
  async getMempoolStats(): Promise<MempoolStats> {
    return this.http.get<MempoolStats>('/api/mempool');
  }

  // ============================================================================
  // Block Methods
  // ============================================================================

  /**
   * Get block by height
   * @param height - Block height
   * @returns Block data
   */
  async getBlock(height: number): Promise<Block> {
    return this.http.get<Block>(`/api/blocks/${height}`);
  }

  /**
   * Get block by hash
   * @param hash - Block hash
   * @returns Block data
   */
  async getBlockByHash(hash: string): Promise<Block> {
    return this.http.get<Block>(`/api/blocks/hash/${hash}`);
  }

  /**
   * Get latest block
   * @returns Latest block data
   */
  async getLatestBlock(): Promise<Block> {
    return this.http.get<Block>('/api/blocks/latest');
  }

  /**
   * Get list of recent blocks
   * @param params - Pagination parameters
   * @returns Paginated list of block summaries
   */
  async getBlocks(params?: PaginationParams): Promise<PaginatedResponse<BlockSummary>> {
    return this.http.get<PaginatedResponse<BlockSummary>>('/api/blocks', params);
  }

  // ============================================================================
  // Transaction Methods
  // ============================================================================

  /**
   * Get transaction by hash
   * @param hash - Transaction hash
   * @returns Transaction data
   */
  async getTransaction(hash: string): Promise<Transaction> {
    return this.http.get<Transaction>(`/api/transactions/${hash}`);
  }

  /**
   * Get transaction receipt
   * @param hash - Transaction hash
   * @returns Transaction receipt
   */
  async getTransactionReceipt(hash: string): Promise<TransactionReceipt> {
    return this.http.get<TransactionReceipt>(`/api/transactions/${hash}/receipt`);
  }

  /**
   * Get recent transactions
   * @param params - Pagination parameters
   * @returns Paginated list of transactions
   */
  async getTransactions(params?: PaginationParams): Promise<PaginatedResponse<Transaction>> {
    return this.http.get<PaginatedResponse<Transaction>>('/api/transactions', params);
  }

  /**
   * Get transactions for an account
   * @param address - Account address
   * @param params - Pagination parameters
   * @returns Paginated list of transactions
   */
  async getAccountTransactions(
    address: string,
    params?: PaginationParams
  ): Promise<PaginatedResponse<Transaction>> {
    return this.http.get<PaginatedResponse<Transaction>>(
      `/api/accounts/${address}/transactions`,
      params
    );
  }

  /**
   * Send a transfer transaction
   * @param from - Sender address
   * @param params - Transfer parameters
   * @param signature - Transaction signature
   * @returns Transaction hash
   */
  async transfer(
    from: string,
    params: TransferParams,
    signature: string
  ): Promise<{ hash: string }> {
    return this.http.post<{ hash: string }>('/api/transactions/transfer', {
      from,
      ...params,
      signature,
    });
  }

  /**
   * Submit a signed transaction
   * @param signedTx - Signed transaction data
   * @returns Transaction hash
   */
  async submitTransaction(signedTx: string): Promise<{ hash: string }> {
    return this.http.post<{ hash: string }>('/api/transactions/submit', {
      transaction: signedTx,
    });
  }

  // ============================================================================
  // Account Methods
  // ============================================================================

  /**
   * Get account information
   * @param address - Account address
   * @returns Account information
   */
  async getAccount(address: string): Promise<Account> {
    return this.http.get<Account>(`/api/accounts/${address}`);
  }

  /**
   * Get account balance breakdown
   * @param address - Account address
   * @returns Account balance
   */
  async getAccountBalance(address: string): Promise<AccountBalance> {
    return this.http.get<AccountBalance>(`/api/accounts/${address}/balance`);
  }

  /**
   * Get account nonce
   * @param address - Account address
   * @returns Current nonce
   */
  async getAccountNonce(address: string): Promise<{ nonce: number }> {
    return this.http.get<{ nonce: number }>(`/api/accounts/${address}/nonce`);
  }

  // ============================================================================
  // Staking Methods
  // ============================================================================

  /**
   * Get staking statistics
   * @returns Staking statistics
   */
  async getStakingStats(): Promise<StakingStats> {
    return this.http.get<StakingStats>('/api/staking/stats');
  }

  /**
   * Get all validators
   * @param params - Pagination parameters
   * @returns Paginated list of validators
   */
  async getValidators(params?: PaginationParams): Promise<PaginatedResponse<Validator>> {
    return this.http.get<PaginatedResponse<Validator>>('/api/staking/validators', params);
  }

  /**
   * Get validator by address
   * @param address - Validator address
   * @returns Validator information
   */
  async getValidator(address: string): Promise<Validator> {
    return this.http.get<Validator>(`/api/staking/validators/${address}`);
  }

  /**
   * Get delegations for an account
   * @param address - Delegator address
   * @returns List of delegations
   */
  async getDelegations(address: string): Promise<Delegation[]> {
    return this.http.get<Delegation[]>(`/api/staking/delegations/${address}`);
  }

  /**
   * Get unbonding entries for an account
   * @param address - Account address
   * @returns List of unbonding entries
   */
  async getUnbondingEntries(address: string): Promise<UnbondingEntry[]> {
    return this.http.get<UnbondingEntry[]>(`/api/staking/unbonding/${address}`);
  }

  /**
   * Stake tokens to become a validator
   * @param address - Staker address
   * @param params - Stake parameters
   * @param signature - Transaction signature
   * @returns Transaction hash
   */
  async stake(
    address: string,
    params: StakeParams,
    signature: string
  ): Promise<{ hash: string }> {
    return this.http.post<{ hash: string }>('/api/staking/stake', {
      address,
      ...params,
      signature,
    });
  }

  /**
   * Delegate tokens to a validator
   * @param delegator - Delegator address
   * @param params - Delegation parameters
   * @param signature - Transaction signature
   * @returns Transaction hash
   */
  async delegate(
    delegator: string,
    params: DelegateParams,
    signature: string
  ): Promise<{ hash: string }> {
    return this.http.post<{ hash: string }>('/api/staking/delegate', {
      delegator,
      ...params,
      signature,
    });
  }

  /**
   * Undelegate tokens from a validator
   * @param delegator - Delegator address
   * @param validator - Validator address
   * @param amount - Amount to undelegate
   * @param signature - Transaction signature
   * @returns Transaction hash
   */
  async undelegate(
    delegator: string,
    validator: string,
    amount: string,
    signature: string
  ): Promise<{ hash: string }> {
    return this.http.post<{ hash: string }>('/api/staking/undelegate', {
      delegator,
      validator,
      amount,
      signature,
    });
  }

  /**
   * Claim staking rewards
   * @param address - Account address
   * @param signature - Transaction signature
   * @returns Transaction hash and claimed amount
   */
  async claimRewards(
    address: string,
    signature: string
  ): Promise<{ hash: string; amount: string }> {
    return this.http.post<{ hash: string; amount: string }>('/api/staking/claim', {
      address,
      signature,
    });
  }

  // ============================================================================
  // Smart Contract Methods
  // ============================================================================

  /**
   * Get contract information
   * @param address - Contract address
   * @returns Contract information
   */
  async getContract(address: string): Promise<Contract> {
    return this.http.get<Contract>(`/api/contracts/${address}`);
  }

  /**
   * Get all deployed contracts
   * @param params - Pagination parameters
   * @returns Paginated list of contracts
   */
  async getContracts(params?: PaginationParams): Promise<PaginatedResponse<Contract>> {
    return this.http.get<PaginatedResponse<Contract>>('/api/contracts/list', params);
  }

  /**
   * Deploy a smart contract
   * @param deployer - Deployer address
   * @param params - Deployment parameters
   * @param signature - Transaction signature
   * @returns Transaction hash and contract address
   */
  async deployContract(
    deployer: string,
    params: DeployContractParams,
    signature: string
  ): Promise<{ hash: string; contractAddress: string }> {
    return this.http.post<{ hash: string; contractAddress: string }>('/api/contracts/deploy', {
      deployer,
      ...params,
      signature,
    });
  }

  /**
   * Call a smart contract function
   * @param caller - Caller address
   * @param params - Call parameters
   * @param signature - Transaction signature (for state-changing calls)
   * @returns Call result
   */
  async callContract(
    caller: string,
    params: CallContractParams,
    signature?: string
  ): Promise<ContractCallResult> {
    return this.http.post<ContractCallResult>('/api/contracts/call', {
      caller,
      ...params,
      signature,
    });
  }

  /**
   * Read contract storage
   * @param address - Contract address
   * @param key - Storage key
   * @returns Storage value
   */
  async readContractStorage(address: string, key: string): Promise<{ value: unknown }> {
    return this.http.post<{ value: unknown }>('/api/contracts/storage', {
      address,
      key,
    });
  }

  // ============================================================================
  // Device/IoT Methods
  // ============================================================================

  /**
   * Get device statistics
   * @returns Device statistics
   */
  async getDeviceStats(): Promise<DeviceStats> {
    return this.http.get<DeviceStats>('/api/devices/stats');
  }

  /**
   * Get device by ID
   * @param deviceId - Device ID
   * @returns Device information
   */
  async getDevice(deviceId: string): Promise<Device> {
    return this.http.get<Device>(`/api/devices/${deviceId}`);
  }

  /**
   * Get devices owned by an address
   * @param owner - Owner address
   * @returns List of devices
   */
  async getDevicesByOwner(owner: string): Promise<Device[]> {
    return this.http.get<Device[]>(`/api/devices/owner/${owner}`);
  }

  /**
   * Register a new device
   * @param owner - Device owner address
   * @param params - Registration parameters
   * @param signature - Transaction signature
   * @returns Device ID
   */
  async registerDevice(
    owner: string,
    params: RegisterDeviceParams,
    signature: string
  ): Promise<{ deviceId: string }> {
    return this.http.post<{ deviceId: string }>('/api/devices/register', {
      owner,
      ...params,
      signature,
    });
  }

  /**
   * Submit IoT data
   * @param owner - Device owner address
   * @param params - Data submission parameters
   * @param signature - Transaction signature
   * @returns Transaction hash
   */
  async submitData(
    owner: string,
    params: SubmitDataParams,
    signature: string
  ): Promise<{ hash: string }> {
    return this.http.post<{ hash: string }>('/api/devices/submit', {
      owner,
      ...params,
      signature,
    });
  }

  // ============================================================================
  // Event Subscription Methods
  // ============================================================================

  /**
   * Subscribe to new blocks
   * @param callback - Callback function
   */
  onNewBlock(callback: EventCallback<Block>): void {
    this.on(EdgeAIEvent.NewBlock, callback);
  }

  /**
   * Subscribe to new transactions
   * @param callback - Callback function
   */
  onNewTransaction(callback: EventCallback<Transaction>): void {
    this.on(EdgeAIEvent.NewTransaction, callback);
  }

  /**
   * Subscribe to connection events
   * @param callback - Callback function
   */
  onConnected(callback: EventCallback<void>): void {
    this.on(EdgeAIEvent.Connected, callback);
  }

  /**
   * Subscribe to disconnection events
   * @param callback - Callback function
   */
  onDisconnected(callback: EventCallback<void>): void {
    this.on(EdgeAIEvent.Disconnected, callback);
  }

  /**
   * Subscribe to error events
   * @param callback - Callback function
   */
  onError(callback: EventCallback<Error>): void {
    this.on(EdgeAIEvent.Error, callback);
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Check if the node is healthy
   * @returns True if healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.getChainStats();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the base URL of the client
   * @returns Base URL
   */
  getBaseUrl(): string {
    return this.config.baseUrl;
  }
}
