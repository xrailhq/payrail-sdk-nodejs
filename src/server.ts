import { FacilitatorClient } from './facilitator-client';
import type { PayRailConfig, VerifyResponse, SettleResponse, PaymentRequirements } from './types';

/**
 * Payment information extracted from X-Payment header
 */
export interface PaymentInfo {
  x402Version: number;
  paymentHeader: string;
  scheme: string;
  network: string;
}

/**
 * Result of payment verification and settlement
 */
export interface PaymentResult {
  success: boolean;
  error?: string;
  txHash?: string;
  networkId?: string;
  verifyResponse?: VerifyResponse;
  settleResponse?: SettleResponse;
}

/**
 * Server-side PayRail SDK for backend/API use
 *
 * Handles payment verification and settlement by:
 * 1. Extracting X-Payment header from requests
 * 2. Verifying payment with facilitator
 * 3. Settling payment on-chain via facilitator
 * 4. Automatically handling 402 responses from facilitator
 *
 * Private Key Usage:
 * - The private key is used to sign EIP-3009 payment authorizations when the facilitator
 *   requires payment (402 response)
 * - When a 402 is received, the SDK automatically creates a signed payment and retries
 *   the request with the X-Payment header
 * - This happens transparently in the FacilitatorClient for both verify() and settle() calls
 */
export class PayRailServer {
  private facilitatorClient: FacilitatorClient;
  private debug: boolean;

  constructor(config: PayRailConfig) {
    this.debug = config.debug ?? false;
    this.facilitatorClient = new FacilitatorClient(config);

    this.log('PayRail Server SDK initialized', {
      facilitator: config.facilitatorUrl,
    });
  }

  /**
   * Extract payment information from request headers
   *
   * @param headers Request headers object (e.g., Express req.headers)
   * @returns Parsed payment info or null if not present
   */
  extractPaymentInfo(headers: Record<string, string | string[] | undefined>): PaymentInfo | null {
    try {
      const paymentHeader = headers['x-payment'] || headers['X-Payment'];

      if (!paymentHeader || Array.isArray(paymentHeader)) {
        return null;
      }

      const parsed = JSON.parse(paymentHeader);

      return {
        x402Version: parsed.x402Version ?? 1,
        paymentHeader: paymentHeader,
        scheme: parsed.scheme,
        network: parsed.network,
      };
    } catch (error) {
      this.logError('Failed to parse X-Payment header', error);
      return null;
    }
  }

  /**
   * Verify a payment with the facilitator
   *
   * @param paymentInfo Payment info from X-Payment header
   * @param paymentRequirements Payment requirements (same as in 402 response)
   * @returns Verification response
   */
  async verify(
    paymentInfo: PaymentInfo,
    paymentRequirements: PaymentRequirements
  ): Promise<VerifyResponse> {
    this.log('Verifying payment with facilitator', { paymentInfo, paymentRequirements });

    const result = await this.facilitatorClient.verify({
      x402Version: paymentInfo.x402Version,
      paymentHeader: paymentInfo.paymentHeader,
      paymentRequirements,
    });

    this.log('Verification result', result);
    return result;
  }

  /**
   * Settle a payment on-chain via the facilitator
   *
   * @param paymentInfo Payment info from X-Payment header
   * @param paymentRequirements Payment requirements (same as in 402 response)
   * @returns Settlement response
   */
  async settle(
    paymentInfo: PaymentInfo,
    paymentRequirements: PaymentRequirements
  ): Promise<SettleResponse> {
    this.log('Settling payment with facilitator', { paymentInfo, paymentRequirements });

    const result = await this.facilitatorClient.settle({
      x402Version: paymentInfo.x402Version,
      paymentHeader: paymentInfo.paymentHeader,
      paymentRequirements,
    });

    this.log('Settlement result', result);
    return result;
  }

  /**
   * Verify and settle a payment in one call
   *
   * This is the recommended way to handle payments in most cases.
   * It first verifies the payment is valid, then settles it on-chain.
   *
   * @param paymentInfo Payment info from X-Payment header
   * @param paymentRequirements Payment requirements (same as in 402 response)
   * @returns Combined payment result
   */
  async verifyAndSettle(
    paymentInfo: PaymentInfo,
    paymentRequirements: PaymentRequirements
  ): Promise<PaymentResult> {
    try {
      // Step 1: Verify
      this.log('Verifying payment');
      const verifyResponse = await this.verify(paymentInfo, paymentRequirements);

      if (!verifyResponse.isValid) {
        this.log('Payment verification failed', verifyResponse.invalidReason);
        return {
          success: false,
          error: verifyResponse.invalidReason || 'Payment verification failed',
          verifyResponse,
        };
      }

      // Step 2: Settle
      this.log('Payment verified, settling on-chain');
      const settleResponse = await this.settle(paymentInfo, paymentRequirements);

      if (!settleResponse.success) {
        this.log('Payment settlement failed', settleResponse.error);
        return {
          success: false,
          error: settleResponse.error || 'Payment settlement failed',
          verifyResponse,
          settleResponse,
        };
      }

      this.log('Payment successful', {
        txHash: settleResponse.txHash,
        network: settleResponse.networkId,
      });

      return {
        success: true,
        txHash: settleResponse.txHash,
        networkId: settleResponse.networkId,
        verifyResponse,
        settleResponse,
      };
    } catch (error) {
      this.logError('Payment processing failed', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Create a 402 Payment Required response
   *
   * Helper function to generate a properly formatted 402 response
   *
   * @param paymentRequirements Payment requirements object
   * @param message Optional custom error message
   * @returns Object to return as 402 response body
   */
  create402Response(
    paymentRequirements: {
      network: string;
      asset: string;
      to: string;
      value: string;
    },
    message?: string
  ) {
    return {
      error: 'Payment Required',
      message: message || 'Payment is required to access this resource',
      x402Version: 1,
      paymentRequirements: paymentRequirements,
    };
  }

  /**
   * Get the facilitator client for manual operations
   */
  getFacilitatorClient(): FacilitatorClient {
    return this.facilitatorClient;
  }

  private log(message: string, data?: any): void {
    if (this.debug) {
      console.log(`[PayRail Server] ${message}`, data ?? '');
    }
  }

  private logError(message: string, error?: any): void {
    if (this.debug) {
      console.error(`[PayRail Server] ${message}`, error ?? '');
    }
  }
}
