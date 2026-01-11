/**
 * EdgeAI Blockchain SDK
 *
 * Official JavaScript/TypeScript SDK for interacting with the EdgeAI Blockchain.
 *
 * @packageDocumentation
 * @module @edgeai/sdk
 *
 * @example
 * ```typescript
 * import { EdgeAIClient } from '@edgeai/sdk';
 *
 * // Create client
 * const client = new EdgeAIClient({
 *   baseUrl: 'https://edgeai-blockchain-node.fly.dev',
 * });
 *
 * // Get chain stats
 * const stats = await client.getChainStats();
 * console.log(`Block height: ${stats.height}`);
 * console.log(`TPS: ${stats.tps}`);
 *
 * // Get account balance
 * const account = await client.getAccount('0x...');
 * console.log(`Balance: ${formatEdge(account.balance)} EDGE`);
 *
 * // Get validators
 * const validators = await client.getValidators();
 * console.log(`Active validators: ${validators.items.length}`);
 *
 * // Get device stats
 * const deviceStats = await client.getDeviceStats();
 * console.log(`Total devices: ${deviceStats.totalDevices}`);
 * ```
 */

// Main client
export { EdgeAIClient } from './client/edgeai';

// HTTP client and errors
export { HttpClient, EdgeAIHttpError } from './client/http';

// All types
export * from './types';

// Utility functions
export * from './utils';

// Version
export const VERSION = '0.1.0';

// Default export
export { EdgeAIClient as default } from './client/edgeai';
