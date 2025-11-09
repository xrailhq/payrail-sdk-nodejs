import type { AxiosInstance, AxiosError } from 'axios';
import { PaymentHandler } from './payment';
import type { PayRailConfig, PaymentRequirements } from './types';

/**
 * Client-side PayRail SDK for browser/frontend use
 *
 * Handles 402 Payment Required responses by:
 * 1. Creating ERC-3009 payment signatures
 * 2. Retrying requests with X-Payment header
 *
 * Note: Does NOT interact with facilitator - that's the server's responsibility
 */
export class PayRailClient {
  private paymentHandler: PaymentHandler;
  private debug: boolean;

  constructor(config: PayRailConfig) {
    this.debug = config.debug ?? false;
    this.paymentHandler = new PaymentHandler(config.privateKey);

    this.log('PayRail Client SDK initialized', {
      wallet: this.paymentHandler.getAddress(),
    });
  }

  /**
   * Attach PayRail interceptor to an axios instance
   * This enables automatic 402 payment handling for all requests
   *
   * @param axiosInstance The axios instance to attach the interceptor to
   */
  attachInterceptor(axiosInstance: AxiosInstance): void {
    this.log('Attaching client interceptor to axios instance');

    axiosInstance.interceptors.response.use(
      // Pass through successful responses
      (response) => response,
      // Handle errors, specifically 402 Payment Required
      async (error: AxiosError) => {
        return this.handleResponseError(error, axiosInstance);
      }
    );
  }

  /**
   * Handle axios response errors, specifically 402 Payment Required
   */
  private async handleResponseError(
    error: AxiosError,
    axiosInstance: AxiosInstance
  ): Promise<any> {
    // Only handle 402 Payment Required errors
    if (error.response?.status !== 402) {
      return Promise.reject(error);
    }

    this.log('402 Payment Required detected, creating payment signature');

    try {
      // Parse payment requirements from response
      const paymentRequirements = this.parsePaymentRequirements(error);

      if (!paymentRequirements) {
        this.logError('Failed to parse payment requirements from 402 response');
        return Promise.reject(
          new Error('Invalid 402 response: missing payment requirements')
        );
      }

      // Create payment header with signature
      const paymentHeader = await this.paymentHandler.createPaymentHeader(
        paymentRequirements
      );

      this.log('Payment signature created, retrying request');

      // Retry the original request with payment proof
      const originalRequest = error.config;
      if (!originalRequest) {
        return Promise.reject(new Error('Original request config not found'));
      }

      // Add payment header to the retry request
      // The server will verify and settle this with the facilitator
      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers['X-Payment'] = paymentHeader;

      this.log('Retrying original request with payment signature');
      return axiosInstance.request(originalRequest);
    } catch (paymentError) {
      this.logError('Payment flow failed', paymentError);
      return Promise.reject(paymentError);
    }
  }

  /**
   * Parse payment requirements from 402 response
   */
  private parsePaymentRequirements(error: AxiosError): PaymentRequirements | null {
    try {
      const data = error.response?.data as any;

      // Extract version (camelCase only)
      const version = data?.x402Version ?? 1;

      // Extract payment requirements from accepts array
      let requirements;
      if (data?.accepts && Array.isArray(data.accepts) && data.accepts.length > 0) {
        // Use first accepted payment requirement
        requirements = data.accepts[0];
      }

      if (!requirements) {
        return null;
      }

      return typeof requirements === 'string' ? JSON.parse(requirements) : requirements
    } catch (error) {
      this.logError('Failed to parse payment requirements', error);
      return null;
    }
  }

  /**
   * Get the payment handler for manual operations
   */
  getPaymentHandler(): PaymentHandler {
    return this.paymentHandler;
  }

  /**
   * Get the wallet address
   */
  getAddress(): string {
    return this.paymentHandler.getAddress();
  }

  private log(message: string, data?: any): void {
    if (this.debug) {
      console.log(`[PayRail Client] ${message}`, data ?? '');
    }
  }

  private logError(message: string, error?: any): void {
    if (this.debug) {
      console.error(`[PayRail Client] ${message}`, error ?? '');
    }
  }
}
