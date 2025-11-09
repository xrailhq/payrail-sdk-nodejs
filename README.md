# @payrail/sdk-nodejs

TypeScript/JavaScript SDK for x402 protocol integration. Provides both **client-side** (browser/frontend) and **server-side** (backend/API) implementations for seamless payment handling.

## Architecture Overview

The SDK is split into two parts to properly implement the x402 protocol:

```
┌─────────────┐              ┌─────────────┐              ┌──────────────┐
│   Client    │──── 402 ────▶│   Server    │──── verify ─▶│ Facilitator  │
│  (Browser)  │              │  (Backend)  │              │              │
│             │              │             │──── settle ─▶│  + Chain     │
│ Creates     │              │ Verifies &  │              └──────────────┘
│ signature   │              │ Settles     │
└─────────────┘              └─────────────┘
      │                             │
      └──── X-Payment header ──────▶
      │                             │
      ◀───── Content (200 OK) ──────┘
```

### Client-Side SDK (`PayRailClient`)
**Use in:** Browser, frontend applications, user wallets

**Responsibilities:**
- Intercepts 402 Payment Required responses
- Creates ERC-3009 payment signatures
- Retries requests with X-Payment header
- **Does NOT** interact with facilitator

### Server-Side SDK (`PayRailServer`)
**Use in:** Backend APIs, Node.js servers, payment processors

**Responsibilities:**
- Extracts X-Payment header from requests
- Verifies payments with facilitator
- Settles payments on-chain via facilitator
- **Does NOT** handle 402 responses or create signatures

## Installation

```bash
npm install @payrail/sdk-nodejs
```

## Quick Start

### Client-Side Usage

```typescript
import axios from 'axios';
import { PayRailClient } from '@payrail/sdk-nodejs';

// Initialize client SDK with user's wallet
const client = new PayRailClient({
  privateKey: userWallet.privateKey,
  debug: true,
});

// Create axios instance for the paid API
const apiClient = axios.create({
  baseURL: 'https://api.example.com',
});

// Attach interceptor - automatically handles 402 responses
client.attachInterceptor(apiClient);

// Make requests - payments are automatic!
try {
  const response = await apiClient.get('/paid-endpoint');
  console.log('Content:', response.data);
} catch (error) {
  console.error('Payment failed:', error);
}
```

**What happens:**
1. Request to `/paid-endpoint` returns 402
2. Client SDK creates ERC-3009 signature
3. Request is retried with `X-Payment` header
4. Server verifies and settles payment
5. Content is returned

### Server-Side Usage

```typescript
import express from 'express';
import { PayRailServer } from '@payrail/sdk-nodejs';

const app = express();
const server = new PayRailServer({
  facilitatorUrl: 'https://facilitator.xrail.io',
  debug: true,
});

// Payment requirements for your endpoint
const PAYMENT_REQUIREMENTS = {
  network: 'base',
  asset: '0x833589fCD6eDb6E08f4c7c32D4f71b54bda02913', // USDC
  to: '0xYourRecipientAddress',
  value: '1000000', // 1 USDC
};

app.get('/paid-endpoint', async (req, res) => {
  // Extract payment info from request
  const paymentInfo = server.extractPaymentInfo(req.headers);

  if (!paymentInfo) {
    // No payment provided - return 402
    return res.status(402).json(
      server.create402Response(PAYMENT_REQUIREMENTS)
    );
  }

  // Verify and settle payment
  const result = await server.verifyAndSettle(
    paymentInfo,
    PAYMENT_REQUIREMENTS
  );

  if (!result.success) {
    // Payment failed - return 402 again
    return res.status(402).json({
      error: 'Payment verification failed',
      reason: result.error,
      ...server.create402Response(PAYMENT_REQUIREMENTS),
    });
  }

  // Payment successful - return content
  console.log('Payment settled:', result.txHash);
  res.json({
    data: 'Your premium content!',
    payment: {
      txHash: result.txHash,
      network: result.networkId,
    },
  });
});

app.listen(3000);
```

**What happens:**
1. Request arrives without X-Payment header → 402
2. Request arrives with X-Payment header
3. Server extracts payment info
4. Server verifies with facilitator
5. Server settles on-chain via facilitator
6. Content is returned

## Complete Flow Example

### 1. Initial Request (No Payment)

**Client:**
```typescript
const response = await apiClient.get('/paid-endpoint');
```

**Server Response:**
```http
HTTP/1.1 402 Payment Required
Content-Type: application/json

{
  "error": "Payment Required",
  "x402_version": 1,
  "payment_requirements": {
    "network": "base",
    "asset": "0x833589fCD6eDb6E08f4c7c32D4f71b54bda02913",
    "to": "0xRecipientAddress",
    "value": "1000000"
  }
}
```

### 2. Client Creates Signature

**Automatic (via interceptor):**
```typescript
// SDK automatically:
// 1. Detects 402 response
// 2. Creates ERC-3009 signature
// 3. Retries with X-Payment header
```

**Manual:**
```typescript
const paymentHandler = client.getPaymentHandler();
const paymentHeader = await paymentHandler.createPaymentHeader({
  version: 1,
  requirements: { /* from 402 response */ },
});
```

### 3. Retry Request with Payment

**Client sends:**
```http
GET /paid-endpoint HTTP/1.1
Host: api.example.com
X-Payment: {"x402_version":1,"scheme":"exact","network":"base","payload":{...}}
```

### 4. Server Verifies and Settles

**Server:**
```typescript
const paymentInfo = server.extractPaymentInfo(req.headers);
const result = await server.verifyAndSettle(
  paymentInfo,
  PAYMENT_REQUIREMENTS
);

if (result.success) {
  // Payment confirmed on-chain
  res.json({ data: 'Content!' });
}
```

### 5. Success Response

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "data": "Your premium content!"
}
```

## Configuration

### Client Configuration

```typescript
interface PayRailConfig {
  // Required: Private key for signing (user's wallet)
  privateKey: string;

  // Optional: Enable debug logging (default: false)
  debug?: boolean;
}
```

### Server Configuration

```typescript
interface PayRailConfig {
  // Required: Facilitator service URL
  facilitatorUrl: string;

  // Optional: Request timeout in milliseconds (default: 30000)
  timeout?: number;

  // Optional: Enable debug logging (default: false)
  debug?: boolean;
}
```

## API Reference

### PayRailClient

#### `constructor(config)`
Creates a new client SDK instance.

#### `attachInterceptor(axiosInstance)`
Attaches payment interceptor to axios instance.

#### `getPaymentHandler()`
Returns the payment handler for manual operations.

#### `getAddress()`
Returns the wallet address.

### PayRailServer

#### `constructor(config)`
Creates a new server SDK instance.

#### `extractPaymentInfo(headers)`
Extracts payment info from request headers.

**Returns:** `PaymentInfo | null`

#### `verify(paymentInfo, paymentRequirements)`
Verifies payment with facilitator.

**Returns:** `Promise<VerifyResponse>`

#### `settle(paymentInfo, paymentRequirements)`
Settles payment on-chain via facilitator.

**Returns:** `Promise<SettleResponse>`

#### `verifyAndSettle(paymentInfo, paymentRequirements)`
Verifies and settles in one call (recommended).

**Returns:** `Promise<PaymentResult>`

#### `create402Response(paymentRequirements, message?)`
Helper to create 402 response object.

**Returns:** Object to send as 402 response body

#### `getFacilitatorClient()`
Returns facilitator client for advanced operations.

## Advanced Usage

### Manual Payment Verification (Server)

```typescript
const paymentInfo = server.extractPaymentInfo(req.headers);

if (paymentInfo) {
  // Verify only (no settlement)
  const verifyResult = await server.verify(
    paymentInfo,
    PAYMENT_REQUIREMENTS
  );

  if (verifyResult.isValid) {
    // Manually decide to settle
    const settleResult = await server.settle(
      paymentInfo,
      PAYMENT_REQUIREMENTS
    );
  }
}
```

### Check Supported Networks

```typescript
const facilitator = server.getFacilitatorClient();
const { kinds } = await facilitator.getSupported();

console.log('Supported:', kinds);
// [{ x402Version: 1, scheme: 'exact', network: 'base' }, ...]
```

### Express Middleware (Server)

```typescript
import { PayRailServer } from '@payrail/sdk-nodejs';

const server = new PayRailServer({
  facilitatorUrl: process.env.FACILITATOR_URL!,
});

// Middleware to handle payments
const requirePayment = (requirements: any) => {
  return async (req: any, res: any, next: any) => {
    const paymentInfo = server.extractPaymentInfo(req.headers);

    if (!paymentInfo) {
      return res.status(402).json(
        server.create402Response(requirements)
      );
    }

    const result = await server.verifyAndSettle(
      paymentInfo,
      requirements
    );

    if (!result.success) {
      return res.status(402).json({
        error: result.error,
        ...server.create402Response(requirements),
      });
    }

    // Attach payment info to request
    req.payment = result;
    next();
  };
};

// Use in routes
app.get(
  '/premium-content',
  requirePayment({
    network: 'base',
    asset: '0x833589fCD6eDb6E08f4c7c32D4f71b54bda02913',
    to: '0xYourAddress',
    value: '1000000',
  }),
  (req, res) => {
    res.json({
      data: 'Premium content',
      txHash: req.payment.txHash,
    });
  }
);
```

## Supported Networks

- Ethereum Mainnet
- Base Mainnet
- Base Sepolia (testnet)
- Arbitrum Sepolia (testnet)
- Anvil (local development)

## Security Considerations

### Client-Side
- Never expose production private keys in browser code
- Use wallet integrations (MetaMask, WalletConnect) in production
- Store test private keys securely during development

### Server-Side
- Never commit facilitator URLs or API keys to version control
- Use environment variables for configuration
- Validate payment amounts before settling
- Implement rate limiting to prevent abuse
- Log all payment transactions for auditing

## TypeScript Support

Full TypeScript definitions included:

```typescript
import type {
  // Client types
  PayRailConfig,
  PaymentRequirements,

  // Server types
  PaymentInfo,
  PaymentResult,
  VerifyRequest,
  VerifyResponse,
  SettleRequest,
  SettleResponse,

  // Shared types
  X402Version,
  NetworkId,
  PaymentScheme,
} from '@payrail/sdk-nodejs';
```

## Examples

See the `/examples` directory for complete examples:

- `client-example.ts` - Browser/frontend usage
- `server-example.ts` - Express.js backend
- `full-stack-example.ts` - Complete client + server flow

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

MIT
