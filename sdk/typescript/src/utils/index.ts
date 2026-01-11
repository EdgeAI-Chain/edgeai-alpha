/**
 * EdgeAI SDK Utility Functions
 * @packageDocumentation
 */

/**
 * Convert EDGE tokens to smallest unit (wei-like)
 * @param amount - Amount in EDGE
 * @returns Amount in smallest unit
 */
export function toSmallestUnit(amount: number | string): string {
  const value = typeof amount === 'string' ? parseFloat(amount) : amount;
  return Math.floor(value * 1e18).toString();
}

/**
 * Convert smallest unit to EDGE tokens
 * @param amount - Amount in smallest unit
 * @returns Amount in EDGE
 */
export function fromSmallestUnit(amount: string | number): string {
  const value = typeof amount === 'string' ? BigInt(amount) : BigInt(amount);
  const edge = Number(value) / 1e18;
  return edge.toFixed(18).replace(/\.?0+$/, '');
}

/**
 * Format EDGE amount for display
 * @param amount - Amount in smallest unit
 * @param decimals - Number of decimal places (default: 4)
 * @returns Formatted string
 */
export function formatEdge(amount: string | number, decimals: number = 4): string {
  const value = typeof amount === 'string' ? BigInt(amount) : BigInt(amount);
  const edge = Number(value) / 1e18;
  return edge.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

/**
 * Validate an EdgeAI address
 * @param address - Address to validate
 * @returns True if valid
 */
export function isValidAddress(address: string): boolean {
  // EdgeAI addresses are 40 hex characters (20 bytes) with optional 0x prefix
  const regex = /^(0x)?[0-9a-fA-F]{40}$/;
  return regex.test(address);
}

/**
 * Normalize an address (add 0x prefix, lowercase)
 * @param address - Address to normalize
 * @returns Normalized address
 */
export function normalizeAddress(address: string): string {
  const cleaned = address.toLowerCase().replace(/^0x/, '');
  return `0x${cleaned}`;
}

/**
 * Validate a transaction hash
 * @param hash - Hash to validate
 * @returns True if valid
 */
export function isValidTxHash(hash: string): boolean {
  // Transaction hashes are 64 hex characters (32 bytes) with optional 0x prefix
  const regex = /^(0x)?[0-9a-fA-F]{64}$/;
  return regex.test(hash);
}

/**
 * Shorten an address for display
 * @param address - Address to shorten
 * @param chars - Number of characters to show on each side (default: 4)
 * @returns Shortened address
 */
export function shortenAddress(address: string, chars: number = 4): string {
  const normalized = normalizeAddress(address);
  return `${normalized.slice(0, chars + 2)}...${normalized.slice(-chars)}`;
}

/**
 * Shorten a hash for display
 * @param hash - Hash to shorten
 * @param chars - Number of characters to show on each side (default: 6)
 * @returns Shortened hash
 */
export function shortenHash(hash: string, chars: number = 6): string {
  const cleaned = hash.replace(/^0x/, '');
  return `${cleaned.slice(0, chars)}...${cleaned.slice(-chars)}`;
}

/**
 * Convert hex string to bytes
 * @param hex - Hex string
 * @returns Uint8Array
 */
export function hexToBytes(hex: string): Uint8Array {
  const cleaned = hex.replace(/^0x/, '');
  const bytes = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleaned.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Convert bytes to hex string
 * @param bytes - Uint8Array
 * @returns Hex string (with 0x prefix)
 */
export function bytesToHex(bytes: Uint8Array): string {
  return '0x' + Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Calculate simple hash of data (for non-cryptographic purposes)
 * @param data - Data to hash
 * @returns Hash string
 */
export function simpleHash(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Sleep for a specified duration
 * @param ms - Duration in milliseconds
 * @returns Promise that resolves after the duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 * @param fn - Function to retry
 * @param maxRetries - Maximum number of retries (default: 3)
 * @param baseDelay - Base delay in ms (default: 1000)
 * @returns Result of the function
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
  }
  
  throw lastError;
}

/**
 * Format a timestamp as a relative time string
 * @param timestamp - ISO timestamp or Date
 * @returns Relative time string (e.g., "5 minutes ago")
 */
export function formatRelativeTime(timestamp: string | Date): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return `${diffSec} seconds ago`;
  if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
  if (diffDay < 30) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
  
  return date.toLocaleDateString();
}

/**
 * Parse a duration string to milliseconds
 * @param duration - Duration string (e.g., "1h", "30m", "1d")
 * @returns Duration in milliseconds
 */
export function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)(s|m|h|d|w)$/);
  if (!match) throw new Error(`Invalid duration: ${duration}`);
  
  const value = parseInt(match[1], 10);
  const unit = match[2];
  
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
  };
  
  return value * multipliers[unit];
}

/**
 * Deep clone an object
 * @param obj - Object to clone
 * @returns Cloned object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Check if a value is a valid JSON string
 * @param str - String to check
 * @returns True if valid JSON
 */
export function isValidJson(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}
