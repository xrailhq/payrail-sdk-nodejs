/**
 * Example usage of @payrail/sdk-nodejs
 *
 * This demonstrates how to integrate PayRail with your axios HTTP client
 * to automatically handle 402 Payment Required responses.
 *
 * CUSTOM TOKEN CONFIGURATION:
 * The payment requirements from your 402 response should include:
 * - network: The network identifier (e.g., "anvil", "base", "ethereum-mainnet")
 * - token: Your custom ERC20 token address (e.g., "0x5FbDB2315678afecb367f032d93F642f64180aa3")
 * - to: The recipient address
 * - value: The amount to transfer (in token's smallest unit)
 */

import 'dotenv/config';
import axios from 'axios';
import { PayRail } from './src/index';

async function main() {
  // Initialize PayRail SDK with your facilitator configuration
  // The facilitator is your payment processor service (verify/settle endpoints)
  const payrail = new PayRail({
    facilitatorUrl: process.env.FACILITATOR_URL || 'http://localhost:3000',
    privateKey: process.env.PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', // Anvil test key
    debug: true, // Enable debug logging to see the payment flow
    timeout: 30000,
  });

  console.log('PayRail SDK initialized');
  console.log('Wallet address:', payrail.getPaymentHandler().getAddress());
  console.log('Facilitator URL:', process.env.FACILITATOR_URL || 'http://localhost:3000');
  console.log('Note: Make sure your custom ERC20 token is deployed and the address is configured');

  // Create an axios instance for the paid API you want to access
  // This is the service that will return 402 Payment Required responses
  const apiClient = axios.create({
    baseURL: process.env.API_BASE_URL || 'http://localhost:8080',
  });

  console.log('Paid API URL:', process.env.API_BASE_URL || 'http://localhost:8080');

  // Attach PayRail interceptor - this is the magic!
  // Now all 402 responses will be automatically handled
  payrail.attachInterceptor(apiClient);

  console.log('\n=== Example 1: Automatic Payment Flow ===');
  try {
    // This request will receive a 402 response
    // PayRail will automatically:
    // 1. Parse payment requirements
    // 2. Create and sign payment header
    // 3. Verify with facilitator
    // 4. Settle payment on-chain
    // 5. Retry the request with payment proof
    const response = await apiClient.get('/paid-endpoint');
    console.log('✅ Request succeeded after payment:', response.data);
  } catch (error) {
    console.error('❌ Request failed:', error);
  }

  console.log('\n=== Example 2: Check Supported Networks ===');
  try {
    const facilitator = payrail.getFacilitatorClient();
    const supported = await facilitator.getSupported();

    console.log('Supported payment configurations:');
    supported.kinds.forEach((kind) => {
      console.log(`  - ${kind.network} (version ${kind.x402Version}, scheme: ${kind.scheme})`);
    });
  } catch (error) {
    console.error('❌ Failed to fetch supported networks:', error);
  }
}

// Run the example
main().catch(console.error);
