---
sidebar_position: 4
---

# Utility Functions

The EdgeAI SDK includes a set of utility functions to simplify common tasks related to data formatting and validation.

## Unit Conversion

Functions for converting between the main currency unit (EDGE) and its smallest denomination (wie, 10^18 wie = 1 EDGE).

### `toSmallestUnit(amount: string | number): string`
Converts a value from EDGE to wie.

```typescript
import { toSmallestUnit } from '@edgeai/sdk';

const wie = toSmallestUnit(1.5); // "1500000000000000000"
```

### `fromSmallestUnit(amount: string | bigint): string`
Converts a value from wie to EDGE.

```typescript
import { fromSmallestUnit } from '@edgeai/sdk';

const edge = fromSmallestUnit('1500000000000000000'); // "1.5"
```

## Formatting

### `formatEdge(amount: string, decimals: number = 2): string`
Formats a wie amount into a human-readable string with commas and a specified number of decimal places.

```typescript
import { formatEdge } from '@edgeai/sdk';

const display = formatEdge('1234567890000000000000'); // "1,234.57"
```

### `shortenAddress(address: string, chars: number = 4): string`
Shortens a blockchain address for display purposes (e.g., `0x1234...5678`).

```typescript
import { shortenAddress } from '@edgeai/sdk';

const short = shortenAddress('0x1234567890abcdef1234567890abcdef12345678');
// "0x1234...5678"
```

### `formatRelativeTime(timestamp: string | Date): string`
Formats a timestamp into a relative time string (e.g., "5 minutes ago").

```typescript
import { formatRelativeTime } from '@edgeai/sdk';

const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
const relative = formatRelativeTime(fiveMinutesAgo); // "5 minutes ago"
```

## Validation

### `isValidAddress(address: string): boolean`
Checks if a given string is a valid EdgeAI blockchain address.

```typescript
import { isValidAddress } from '@edgeai/sdk';

const valid = isValidAddress('0x1234567890abcdef1234567890abcdef12345678'); // true
const invalid = isValidAddress('not-an-address'); // false
```
