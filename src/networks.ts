/**
 * Network configuration for x402 payments
 */

export interface NetworkConfig {
  chainId: number;
  tokenAddress: string;
  name: string;
}

/**
 * Supported network configurations
 *
 * NOTE: Token addresses are defaults and can be overridden by payment requirements.
 * When a 402 response includes a custom token address in the payment requirements,
 * that address will be used instead of the default configured here.
 */
export const NETWORKS: Record<string, NetworkConfig> = {
  'ethereum-mainnet': {
    chainId: 1,
    tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC on Ethereum
    name: 'Ethereum Mainnet',
  },
  'base': {
    chainId: 8453,
    tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
    name: 'Base',
  },
  'base-sepolia': {
    chainId: 84532,
    tokenAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // USDC on Base Sepolia
    name: 'Base Sepolia',
  },
  'arbitrum-sepolia': {
    chainId: 421614,
    tokenAddress: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d', // USDC on Arbitrum Sepolia
    name: 'Arbitrum Sepolia',
  },
  'anvil': {
    chainId: 31337,
    tokenAddress: '0x0000000000000000000000000000000000000000', // Placeholder, should be configured
    name: 'Anvil',
  },
  'localhost': {
    chainId: 31337,
    tokenAddress: '0x0000000000000000000000000000000000000000', // Placeholder, should be configured
    name: 'Localhost',
  },
};

/**
 * Get network configuration by network ID
 */
export function getNetworkConfig(networkId: string): NetworkConfig {
  const config = NETWORKS[networkId];
  if (!config) {
    throw new Error(`Unsupported network: ${networkId}`);
  }
  return config;
}
