/**
 * Fetch with Timeout and Circuit Breaker
 *
 * Provides resilient HTTP fetching with:
 * - Configurable timeouts
 * - Circuit breaker pattern
 * - Automatic retry with exponential backoff
 * - Request logging
 */

import logger from '@/lib/logger';

interface FetchOptions extends RequestInit {
  timeout?: number; // milliseconds
  retries?: number;
  retryDelay?: number; // base delay in ms
  circuitBreaker?: CircuitBreaker;
}

interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetTimeout?: number; // ms
  halfOpenRequests?: number;
}

type CircuitState = 'closed' | 'open' | 'half-open';

/**
 * Circuit Breaker implementation
 * Prevents cascading failures when external services are down
 */
export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures: number = 0;
  private lastFailure: number = 0;
  private halfOpenAttempts: number = 0;

  private readonly failureThreshold: number;
  private readonly resetTimeout: number;
  private readonly halfOpenRequests: number;
  private readonly serviceName: string;

  constructor(serviceName: string, options: CircuitBreakerOptions = {}) {
    this.serviceName = serviceName;
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000; // 1 minute
    this.halfOpenRequests = options.halfOpenRequests || 1;
  }

  canRequest(): boolean {
    if (this.state === 'closed') {
      return true;
    }

    if (this.state === 'open') {
      // Check if enough time has passed to try half-open
      if (Date.now() - this.lastFailure >= this.resetTimeout) {
        this.state = 'half-open';
        this.halfOpenAttempts = 0;
        logger.info(`Circuit breaker ${this.serviceName}: transitioning to half-open`);
        return true;
      }
      return false;
    }

    // half-open state - allow limited requests
    if (this.halfOpenAttempts < this.halfOpenRequests) {
      return true;
    }

    return false;
  }

  recordSuccess(): void {
    if (this.state === 'half-open') {
      this.state = 'closed';
      this.failures = 0;
      logger.info(`Circuit breaker ${this.serviceName}: closed (service recovered)`);
    } else if (this.state === 'closed') {
      this.failures = 0; // Reset on success
    }
  }

  recordFailure(): void {
    this.failures++;
    this.lastFailure = Date.now();

    if (this.state === 'half-open') {
      this.halfOpenAttempts++;
      if (this.halfOpenAttempts >= this.halfOpenRequests) {
        this.state = 'open';
        logger.warn(`Circuit breaker ${this.serviceName}: re-opened (still failing)`);
      }
    } else if (this.state === 'closed' && this.failures >= this.failureThreshold) {
      this.state = 'open';
      logger.error(`Circuit breaker ${this.serviceName}: OPENED after ${this.failures} failures`);
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats(): { state: CircuitState; failures: number; lastFailure: number } {
    return {
      state: this.state,
      failures: this.failures,
      lastFailure: this.lastFailure,
    };
  }

  reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.halfOpenAttempts = 0;
    logger.info(`Circuit breaker ${this.serviceName}: manually reset`);
  }
}

/**
 * Fetch with timeout using AbortController
 *
 * @param url - URL to fetch
 * @param options - Fetch options with timeout
 * @returns Response
 * @throws Error if timeout or network failure
 */
export async function fetchWithTimeout(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const {
    timeout = 30000, // 30 seconds default
    retries = 0,
    retryDelay = 1000,
    circuitBreaker,
    ...fetchOptions
  } = options;

  // Check circuit breaker
  if (circuitBreaker && !circuitBreaker.canRequest()) {
    throw new Error(`Circuit breaker open for request to ${url}`);
  }

  let lastError: Error | null = null;
  const maxAttempts = retries + 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Record success for circuit breaker
      if (circuitBreaker) {
        circuitBreaker.recordSuccess();
      }

      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);

      // Handle abort (timeout)
      if (error.name === 'AbortError') {
        lastError = new Error(`Request to ${url} timed out after ${timeout}ms`);
      } else {
        lastError = error;
      }

      // Record failure for circuit breaker
      if (circuitBreaker) {
        circuitBreaker.recordFailure();
      }

      // Log retry attempt
      if (attempt < maxAttempts) {
        const delay = retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
        logger.warn(`Fetch attempt ${attempt}/${maxAttempts} failed, retrying in ${delay}ms`, {
          url,
          error: lastError.message,
        });
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // All retries exhausted
  logger.error(`All fetch attempts failed for ${url}`, lastError as Error);
  throw lastError;
}

// Pre-configured circuit breakers for common services
export const graphApiCircuitBreaker = new CircuitBreaker('Microsoft Graph API', {
  failureThreshold: 5,
  resetTimeout: 60000,
});

export const openAICircuitBreaker = new CircuitBreaker('OpenAI API', {
  failureThreshold: 3,
  resetTimeout: 30000,
});

export const n8nCircuitBreaker = new CircuitBreaker('N8N Webhooks', {
  failureThreshold: 3,
  resetTimeout: 120000,
});

/**
 * Convenience function for Graph API calls
 */
export async function fetchGraphAPI(
  url: string,
  options: Omit<FetchOptions, 'circuitBreaker'> = {}
): Promise<Response> {
  return fetchWithTimeout(url, {
    ...options,
    timeout: options.timeout || 30000,
    retries: options.retries ?? 2,
    circuitBreaker: graphApiCircuitBreaker,
  });
}

/**
 * Convenience function for N8N webhook calls
 */
export async function fetchN8N(
  url: string,
  options: Omit<FetchOptions, 'circuitBreaker'> = {}
): Promise<Response> {
  return fetchWithTimeout(url, {
    ...options,
    timeout: options.timeout || 10000,
    retries: options.retries ?? 1,
    circuitBreaker: n8nCircuitBreaker,
  });
}
