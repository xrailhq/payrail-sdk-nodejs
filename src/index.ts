/**
 * @payrail/sdk-nodejs - SDK for x402 protocol
 *
 * This SDK is split into two parts:
 *
 * CLIENT-SIDE (Browser/Frontend):
 * - PayRailClient: Handles 402 responses and creates ERC-3009 payment signatures
 * - Does NOT interact with facilitator
 *
 * SERVER-SIDE (Backend/API):
 * - PayRailServer: Verifies and settles payments with the facilitator
 * - Handles 402 responses from facilitator and creates payment signatures (requires private key)
 *
 * Example usage:
 *
 * Client-side:
 * ```typescript
 * import { PayRailClient } from '@payrail/sdk';
 * const client = new PayRailClient({ privateKey: userWallet });
 * client.attachInterceptor(axios);
 * ```
 *
 * Server-side:
 * ```typescript
 * import { PayRailServer } from '@payrail/sdk';
 * const server = new PayRailServer({
 *   facilitatorUrl: '...',
 *   privateKey: '0x...' // Required to pay facilitator if it's not free
 * });
 * const paymentInfo = server.extractPaymentInfo(req.headers);
 * const result = await server.verifyAndSettle(paymentInfo, requirements);
 * ```
 */

// Client-side SDK
export { PayRailClient } from './client';

// Server-side SDK
export { PayRailServer } from './server';

// Shared utilities
export { FacilitatorClient } from './facilitator-client';
export { PaymentHandler } from './payment';
export { NETWORKS, getNetworkConfig } from './networks';

export type {
  PayRailConfig,
  VerifyRequest,
  VerifyResponse,
  SettleRequest,
  SettleResponse,
  SupportedKind,
  SupportedResponse,
  PaymentRequirements,
  X402Version,
  NetworkId,
  PaymentScheme,
} from './types';

export type { NetworkConfig } from './networks';
export type { PaymentInfo, PaymentResult } from './server';
