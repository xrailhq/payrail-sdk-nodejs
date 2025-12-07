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
 * - Handles 402 responses from facilitator and creates payment signatures
 *
 * ## Private Key Handling
 *
 * A private key is required for signing payment authorizations. You can either:
 * - Use an existing key (e.g., from environment variables)
 * - Generate a new key using `generatePrivateKey()`
 *
 * **IMPORTANT:** Generated keys should be persisted and reused. Each key corresponds
 * to an on-chain wallet address that needs to be funded.
 *
 * **TIP:** If you use the same wallet address as your payment recipient (`payTo`),
 * the wallet will be automatically funded with each successful payment settlement.
 * This means you can use the same key for both receiving payments and paying for
 * facilitator fees without manual funding.
 *
 * ## Example usage:
 *
 * ### Generating a new key (first-time setup):
 * ```typescript
 * import { generatePrivateKey } from '@payrail/sdk';
 *
 * // Generate a new key pair
 * const key = generatePrivateKey();
 * console.log('New wallet address:', key.address);
 * console.log('Save the private key securely');
 *
 * // Use key.address as your payTo address in payment requirements
 * // Payments you receive will fund this wallet automatically
 *
 * // Persist the key (example: save to .env file)
 * fs.writeFileSync('.env', `PRIVATE_KEY=${key.privateKey}\n`);
 * ```
 *
 * ### Client-side:
 * ```typescript
 * import { PayRailClient } from '@payrail/sdk';
 *
 * // Load or generate key
 * let privateKey = localStorage.getItem('payrail_key');
 * if (!privateKey) {
 *   const key = generatePrivateKey();
 *   localStorage.setItem('payrail_key', key.privateKey);
 *   privateKey = key.privateKey;
 *   console.log('New wallet created:', key.address);
 * }
 *
 * const client = new PayRailClient({
 *   facilitatorUrl: '...',
 *   privateKey
 * });
 * client.attachInterceptor(axios);
 * ```
 *
 * ### Server-side:
 * ```typescript
 * import { PayRailServer, getAddressFromPrivateKey } from '@payrail/sdk';
 *
 * const privateKey = process.env.PRIVATE_KEY;
 * const walletAddress = getAddressFromPrivateKey(privateKey);
 *
 * const server = new PayRailServer({
 *   facilitatorUrl: '...',
 *   privateKey
 * });
 *
 * // Use walletAddress as payTo - received payments fund the same wallet
 * // used for facilitator fees, creating a self-sustaining system
 * const paymentRequirements = {
 *   payTo: walletAddress,
 *   // ... other requirements
 * };
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
export {
  generatePrivateKey,
  isValidPrivateKey,
  getAddressFromPrivateKey,
} from './key-utils';

export type {
  PayRailConfig,
  VerifyRequest,
  VerifyResponse,
  SettleRequest,
  SettleResponse,
  SupportedKind,
  SupportedResponse,
  PaymentRequirements,
  PaymentRequiredResponse,
  PaymentPayload,
  ExactEvmPayload,
  ExactEvmPayloadAuthorization,
  EIP3009Authorization, // deprecated alias
  X402Version,
  NetworkId,
  PaymentScheme,
} from './types';

export type { NetworkConfig } from './networks';
export type { PaymentInfo, PaymentResult } from './server';
export type { GeneratedKey } from './key-utils';
