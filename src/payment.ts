import { ethers, TypedDataEncoder } from 'ethers';
import { randomBytes } from 'crypto';
import type { PaymentRequirements } from './types';
import { getNetworkConfig } from './networks';

/**
 * EIP-712 domain for USDC transferWithAuthorization
 */
interface EIP712Domain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: string;
}

/**
 * USDC TransferWithAuthorization parameters for EIP-712 signing
 * Note: validAfter and validBefore are strings to match uint256 encoding
 */
interface TransferWithAuthorization {
  from: string;
  to: string;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: string;
}

/**
 * Handles payment header creation and signing
 */
export class PaymentHandler {
  private wallet: ethers.Wallet;

  constructor(privateKey: string) {
    // Normalize private key format
    const normalizedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
    this.wallet = new ethers.Wallet(normalizedKey);
  }

  /**
   * Create a signed payment header from payment requirements
   *
   * @param requirements Payment requirements from 402 response
   * @returns Signed payment header as JSON string
   */
  async createPaymentHeader(requirements: PaymentRequirements): Promise<string> {
    // Extract payment parameters (support both new and old formats)
    const network = requirements.network as string;
    const to = requirements.payTo as string;
    const value = requirements.maxAmountRequired as string;
    const tokenAddress = requirements.asset as string;

    // Get network configuration
    const networkConfig = getNetworkConfig(network);
    const chainId = networkConfig.chainId;
    const verifyingContract = (tokenAddress || networkConfig.tokenAddress).toLowerCase();

    // Generate nonce (32 bytes)
    const nonceBytes = randomBytes(32);
    const nonce = '0x' + nonceBytes.toString('hex');

    // Calculate time window
    const currentTime = Math.floor(Date.now() / 1000);
    let validAfter: number;
    let validBefore: number;

    if (network === 'anvil' || network === 'localhost') {
      // For Anvil: valid from epoch to year 3000
      validAfter = 0;
      validBefore = 32503680000;
    } else {
      // For real networks: 1 hour window
      validAfter = currentTime - 3600;
      validBefore = currentTime + 3600;
    }

    // Get token metadata based on the actual token address
    const tokenMetadata = this.getTokenMetadata(verifyingContract.toLowerCase(), network);

    // Build EIP-712 domain
    const domain: EIP712Domain = {
      name: tokenMetadata.name,
      version: tokenMetadata.version,
      chainId,
      verifyingContract,
    };

    // Build TransferWithAuthorization message
    // Note: Addresses should be lowercase for EIP-712 encoding
    const message: TransferWithAuthorization = {
      from: this.wallet.address.toLowerCase(),
      to: to.toLowerCase(),
      value,
      validAfter: validAfter.toString(),
      validBefore: validBefore.toString(),
      nonce,
    };

    // Define EIP-712 types
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

    // Sign using EIP-712
    const signature = await this.wallet.signTypedData(domain, types, message);

    // Build payment header JSON
    const paymentHeader = {
      x402Version: 1,
      scheme: 'exact',
      network,
      payload: {
        signature, // Already in correct format: 0xRRRRRR...SSSSSS...VV
        authorization: {
          from: this.wallet.address.toLowerCase(),
          to: to.toLowerCase(),
          value,
          validAfter: validAfter.toString(),
          validBefore: validBefore.toString(),
          nonce,
        },
      },
    };

    // Return as JSON string
    return JSON.stringify(paymentHeader);
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
   * Get the wallet address
   */
  getAddress(): string {
    return this.wallet.address;
  }

  /**
   * Get the wallet instance (for advanced usage)
   */
  getWallet(): ethers.Wallet {
    return this.wallet;
  }
}
