import { ethers } from 'ethers';

/**
 * Generated key information
 */
export interface GeneratedKey {
  /** Private key in hex format with 0x prefix */
  privateKey: string;
  /** Public address derived from the private key */
  address: string;
}

/**
 * Generate a new random Ethereum private key.
 *
 * **IMPORTANT:** Generated keys should be persisted and reused. Each key corresponds
 * to an on-chain wallet address that needs to be funded.
 *
 * **TIP:** If you use the generated address as your payment recipient (`payTo`),
 * the wallet will be automatically funded with each successful payment settlement.
 *
 * @returns The generated key information (privateKey and address)
 *
 * @example
 * import { generatePrivateKey } from '@payrail/sdk';
 *
 * // Generate a new key pair
 * const key = generatePrivateKey();
 * console.log('Wallet address:', key.address);
 *
 * // Persist the key for reuse
 * fs.writeFileSync('.env', `PRIVATE_KEY=${key.privateKey}\n`);
 *
 * // Use key.address as payTo to receive payments into this wallet
 */
export function generatePrivateKey(): GeneratedKey {
  const wallet = ethers.Wallet.createRandom();

  return {
    privateKey: wallet.privateKey,
    address: wallet.address,
  };
}

/**
 * Validate that a string is a valid Ethereum private key
 *
 * @param privateKey The private key to validate
 * @returns true if valid, false otherwise
 *
 * @example
 * if (!isValidPrivateKey(process.env.PRIVATE_KEY)) {
 *   throw new Error('Invalid PRIVATE_KEY in environment');
 * }
 */
export function isValidPrivateKey(privateKey: string): boolean {
  try {
    const normalized = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
    new ethers.Wallet(normalized);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the Ethereum address from a private key
 *
 * @param privateKey The private key (hex string with or without 0x prefix)
 * @returns The Ethereum address
 *
 * @example
 * const address = getAddressFromPrivateKey(process.env.PRIVATE_KEY);
 * console.log('Wallet address:', address);
 *
 * // Use as payTo to receive payments into the same wallet
 * const paymentRequirements = { payTo: address, ... };
 */
export function getAddressFromPrivateKey(privateKey: string): string {
  const normalized = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
  const wallet = new ethers.Wallet(normalized);
  return wallet.address;
}
