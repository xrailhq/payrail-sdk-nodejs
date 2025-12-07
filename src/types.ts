/**
 * x402 protocol version
 */
export type X402Version = number;

/**
 * Network identifiers supported by the facilitator
 */
export type NetworkId =
  | 'arbitrum-sepolia'
  | 'base-sepolia'
  | 'base'
  | 'ethereum-mainnet'
  | 'anvil'
  | string;

/**
 * Payment scheme type
 */
export type PaymentScheme = 'exact' | string;

/**
 * Request to verify a payment
 */
export interface VerifyRequest {
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirements;
}

/**
 * Payment requirements type
 */
export interface PaymentRequirements {
  scheme: string;
  network: string;
  maxAmountRequired: string;
  resource: string;
  description: string;
  mimeType: string;
  outputSchema?: object;
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;
  extra?: object;
}

/**
 * Payment required response (402 status)
 */
export interface PaymentRequiredResponse {
  x402Version: number;
  accepts: PaymentRequirements[];
  error?: string;
}


/**
 * EIP-3009 Authorization parameters for transferWithAuthorization
 * Aligned with x402 ExactEvmPayloadAuthorization
 */
export interface ExactEvmPayloadAuthorization {
  from: string;        // Ethereum address (payer)
  to: string;          // Ethereum address (recipient/resource server)
  value: string;       // String representation of token amount
  validAfter: string;  // Unix timestamp as string (start validity)
  validBefore: string; // Unix timestamp as string (end validity)
  nonce: string;       // Hexadecimal hash for replay protection
}

/**
 * @deprecated Use ExactEvmPayloadAuthorization instead
 */
export type EIP3009Authorization = ExactEvmPayloadAuthorization;

/**
 * Payload for exact EVM scheme payment
 * Aligned with x402 ExactEvmPayload
 */
export interface ExactEvmPayload {
  signature: string;                // Hexadecimal string of EIP-3009 signature
  authorization: ExactEvmPayloadAuthorization;
}

/**
 * Payment payload sent in X-Payment header
 * Aligned with x402 PaymentPayload
 */
export interface PaymentPayload {
  x402Version: number;
  scheme: string;
  network: string;
  payload: ExactEvmPayload | object; // ExactEvmPayload for EVM, can be extended for other schemes
}

/**
 * Response from payment verification
 */
export interface VerifyResponse {
  isValid: boolean;
  invalidReason?: string;
  payer?: string;
}

/**
 * Request to settle a payment on-chain
 */
export interface SettleRequest {
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirements;
}

/**
 * Response from payment settlement
 */
export interface SettleResponse {
  success: boolean;
  errorReason?: string;
  payer?: string;
  transaction: string;
  network: string;
}

/**
 * Supported payment kind/configuration
 */
export interface SupportedKind {
  x402Version: X402Version;
  scheme: PaymentScheme;
  network: NetworkId;
}

/**
 * Response listing all supported payment configurations
 */
export interface SupportedResponse {
  kinds: SupportedKind[];
}

/**
 * Configuration for the PayRail SDK
 */
export interface PayRailConfig {
  /**
   * Base URL of the facilitator service
   * @example "https://facilitator.example.com"
   */
  facilitatorUrl: string;

  /**
   * Private key for signing transactions (hex string with or without 0x prefix)
   *
   * Use `generatePrivateKey()` from this package to create a new key if needed.
   * Generated keys should be persisted and reused - each key corresponds to an
   * on-chain wallet address that needs to be funded.
   *
   * @example
   * // Use existing key from environment
   * privateKey: process.env.PRIVATE_KEY
   *
   * @example
   * // Generate and persist a new key
   * import { generatePrivateKey } from '@payrail/sdk';
   * const key = generatePrivateKey();
   * // Save key.privateKey to storage, then use it
   * privateKey: key.privateKey
   */
  privateKey: string;

  /**
   * Optional: Custom timeout for requests in milliseconds
   * @default 30000
   */
  timeout?: number;

  /**
   * Optional: Enable debug logging
   * @default false
   */
  debug?: boolean;
}