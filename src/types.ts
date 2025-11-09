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
  x402Version: X402Version;
  paymentHeader: string;
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
  outputSchema?: object | null;
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;
  extra: object | null
}

/**
 * Payment required response
 */
export interface PaymentRequiredResponse {
  x402Version: number;
  accepts: [PaymentRequirements];
  error: string
}


/**
 * EIP-3009 Authorization parameters for transferWithAuthorization
 */
export interface EIP3009Authorization {
  from: string;        // Ethereum address (payer)
  to: string;          // Ethereum address (recipient/resource server)
  value: string;       // String representation of token amount
  validAfter: number;  // Unix timestamp (start validity)
  validBefore: number; // Unix timestamp (end validity)
  nonce: string;       // Hexadecimal hash for replay protection
}

/**
 * Payload for exact EVM scheme payment
 */
export interface ExactEVMPayload {
  signature: string;                // Hexadecimal string of EIP-3009 signature
  authorization: EIP3009Authorization;
}

export interface PaymentPayload {
  x402Version: number;
  scheme: string;
  network: string;
  payload: ExactEVMPayload;
}

/**
 * Response from payment verification
 */
export interface VerifyResponse {
  isValid: boolean;
  invalidReason?: string;
}

/**
 * Request to settle a payment on-chain
 */
export interface SettleRequest {
  x402Version: X402Version;
  paymentHeader: string;
  paymentRequirements: PaymentRequirements;
}

/**
 * Response from payment settlement
 */
export interface SettleResponse {
  success: boolean;
  error?: string;
  txHash?: string;
  networkId?: string;
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