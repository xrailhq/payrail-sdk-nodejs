import axios, { AxiosError, AxiosInstance } from 'axios';
import { ethers } from 'ethers';
import type {
  VerifyRequest,
  VerifyResponse,
  SettleRequest,
  SettleResponse,
  SupportedResponse,
  PayRailConfig,
  PaymentRequiredResponse,
  PaymentPayload,
  ExactEVMPayload,
  EIP3009Authorization,
  PaymentRequirements,
} from './types';

/**
 * Client for communicating with the x402 facilitator service
 */
export class FacilitatorClient {
  private client: AxiosInstance;
  private debug: boolean;
  private privateKey: string;
  private wallet: ethers.Wallet;

  constructor(config: PayRailConfig) {
    this.debug = config.debug ?? false;
    this.privateKey = config.privateKey;
    this.wallet = new ethers.Wallet(this.privateKey);

    this.client = axios.create({
      baseURL: config.facilitatorUrl,
      timeout: config.timeout ?? 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.log('FacilitatorClient initialized', { url: config.facilitatorUrl });
  }

  /**
   * Verify a payment with the facilitator
   */
  async verify(request: VerifyRequest): Promise<VerifyResponse> {
    this.log('Verifying payment', request);

    try {
      const response = await this.client.post<VerifyResponse>('/verify', {
        x402Version: request.x402Version,
        paymentHeader: request.paymentHeader,
        paymentRequirements: request.paymentRequirements,
      });

      this.log(`Verification response status: ${response.status}, data ${response.data}`);
      return response.data;
    } catch (error) {

      if (axios.isAxiosError(error)) {
        if (error.status == 402) {
          this.log("Facilitator requires payment - handling 402 response");
          let paymentRequiredResponse: PaymentRequiredResponse = error.response?.data
          this.log("Payment required response:", paymentRequiredResponse)

          // Prepare PaymentPayload according to exact EVM scheme
          // https://github.com/coinbase/x402/blob/main/specs/schemes/exact/scheme_exact_evm.md
          const paymentRequirement = paymentRequiredResponse.accepts[0];

          const paymentPayload = await this.prepareExactEVMPayment(
            paymentRequiredResponse.x402Version,
            paymentRequirement
          );

          this.log("Prepared payment payload for facilitator", paymentPayload);

          // Retry the request with X-Payment header
          this.log("Retrying verify request with payment");
          const retryResponse = await this.client.post<VerifyResponse>(
            '/verify',
            {
              x402Version: request.x402Version,
              paymentHeader: request.paymentHeader,
              paymentRequirements: request.paymentRequirements,
            },
            {
              headers: {
                'X-Payment': JSON.stringify(paymentPayload),
              },
            }
          );

          this.log(`Verification successful after payment, status: ${retryResponse.status}`);
          return retryResponse.data;
        }
      }

      this.logError('Verification failed', error);
      throw new Error(`Payment verification failed: ${this.getErrorMessage(error)}`);
    }
  }

  /**
   * Settle a payment on-chain via the facilitator
   */
  async settle(request: SettleRequest): Promise<SettleResponse> {
    this.log('Settling payment', request);

    try {
      const response = await this.client.post<SettleResponse>('/settle', {
        x402Version: request.x402Version,
        paymentHeader: request.paymentHeader,
        paymentRequirements: request.paymentRequirements,
      });

      this.log('Settlement response', response.data);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.status == 402) {
          this.log("Facilitator requires payment for settlement - handling 402 response");
          let paymentRequiredResponse: PaymentRequiredResponse = error.response?.data
          this.log("Payment required response:", paymentRequiredResponse)

          // Prepare PaymentPayload according to exact EVM scheme
          const paymentRequirement = paymentRequiredResponse.accepts[0];

          const paymentPayload = await this.prepareExactEVMPayment(
            paymentRequiredResponse.x402Version,
            paymentRequirement
          );

          this.log("Prepared payment payload for facilitator", paymentPayload);

          // Retry the request with X-Payment header
          this.log("Retrying settle request with payment");
          const retryResponse = await this.client.post<SettleResponse>(
            '/settle',
            {
              x402Version: request.x402Version,
              paymentHeader: request.paymentHeader,
              paymentRequirements: request.paymentRequirements,
            },
            {
              headers: {
                'X-Payment': JSON.stringify(paymentPayload),
              },
            }
          );

          this.log(`Settlement successful after payment, status: ${retryResponse.status}`);
          return retryResponse.data;
        }
      }

      this.logError('Settlement failed', error);
      throw new Error(`Payment settlement failed: ${this.getErrorMessage(error)}`);
    }
  }

  /**
   * Get supported payment configurations from the facilitator
   */
  async getSupported(): Promise<SupportedResponse> {
    this.log('Fetching supported configurations');

    try {
      const response = await this.client.get<SupportedResponse>('/supported');
      this.log('Supported configurations', response.data);
      return response.data;
    } catch (error) {
      this.logError('Failed to fetch supported configurations', error);
      throw new Error(`Failed to get supported configurations: ${this.getErrorMessage(error)}`);
    }
  }

  /**
   * Prepare payment payload for exact EVM scheme using EIP-3009
   */
  private async prepareExactEVMPayment(
    x402Version: number,
    paymentRequirement: PaymentRequirements
  ): Promise<PaymentPayload> {
    const now = Math.floor(Date.now() / 1000);

    // Generate random nonce for replay protection
    const nonce = ethers.hexlify(ethers.randomBytes(32));

    // Create EIP-3009 authorization object (addresses must be lowercase for EIP-712)
    const authorization: EIP3009Authorization = {
      from: this.wallet.address.toLowerCase(),
      to: paymentRequirement.payTo.toLowerCase(),
      value: paymentRequirement.maxAmountRequired,
      validAfter: now,
      validBefore: now + paymentRequirement.maxTimeoutSeconds,
      nonce: nonce,
    };

    // Get token metadata based on the actual token address
    const tokenMetadata = this.getTokenMetadata(
      paymentRequirement.asset.toLowerCase(),
      paymentRequirement.network
    );

    // EIP-712 domain for the token contract
    const domain = {
      name: tokenMetadata.name,
      version: tokenMetadata.version,
      chainId: this.getChainIdFromNetwork(paymentRequirement.network),
      verifyingContract: paymentRequirement.asset,
    };

    // EIP-712 types for EIP-3009 transferWithAuthorization
    const types = {
      TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
      ],
    };

    // Sign the authorization using EIP-712
    const signature = await this.wallet.signTypedData(domain, types, authorization);

    const payload: ExactEVMPayload = {
      signature,
      authorization,
    };

    return {
      x402Version,
      scheme: paymentRequirement.scheme,
      network: paymentRequirement.network,
      payload,
    };
  }

  /**
   * Get token metadata (name and version) based on address and network
   */
  private getTokenMetadata(tokenAddress: string, network: string): { name: string; version: string } {
    const addrLower = tokenAddress.toLowerCase();

    // Known USDC contracts
    switch (addrLower) {
      // Base mainnet USDC
      case '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913':
        return { name: 'USD Coin', version: '2' };

      // Ethereum mainnet USDC
      case '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48':
        return { name: 'USD Coin', version: '2' };

      // Base Sepolia - official testnet USDC
      case '0x036cbd53842c5426634e7929541ec2318f3dcf7e':
        return { name: 'USDC', version: '2' };

      // Arbitrum Sepolia test USDC
      case '0x75faf114eafb1bdbe2f0316df893fd58ce46aa4d':
        return { name: 'Test USD Coin', version: '2' };

      // Default for unknown addresses (test deployments)
      default:
        return { name: 'Test USD Coin', version: '2' };
    }
  }

  /**
   * Get numeric chain ID from network identifier
   */
  private getChainIdFromNetwork(network: string): number {
    const chainIds: Record<string, number> = {
      'ethereum-mainnet': 1,
      'base': 8453,
      'base-sepolia': 84532,
      'arbitrum-sepolia': 421614,
      'anvil': 31337,
    };
    return chainIds[network] || 1;
  }

  private log(message: string, data?: any): void {
    if (this.debug) {
      console.log(`[PayRail] ${message}`, data ?? '');
    }
  }

  private logError(message: string, error: any): void {
    if (this.debug) {
      console.error(`[PayRail] ${message}`, error);
    }
  }

  private getErrorMessage(error: any): string {
    if (axios.isAxiosError(error)) {
      return error.response?.data?.message ?? error.message;
    }
    return error instanceof Error ? error.message : String(error);
  }
}
