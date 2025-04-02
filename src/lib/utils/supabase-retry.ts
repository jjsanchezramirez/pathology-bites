// src/lib/utils/supabase-retry.ts
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
  onRetry?: (error: any, attempt: number) => void;
  retryableStatuses?: number[];
  retryableErrorMessages?: string[];
}

/**
 * Executes a Supabase auth operation with retry capabilities for network issues
 * 
 * @param operation The Supabase operation to execute
 * @param options Retry configuration options
 * @returns The result of the Supabase operation
 */
export async function withSupabaseRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 500,
    maxDelayMs = 5000,
    backoffFactor = 2,
    onRetry,
    retryableStatuses = [408, 429, 500, 502, 503, 504],
    retryableErrorMessages = [
      'network',
      'fetch failed',
      'timeout',
      'connection',
      'socket',
      'offline',
      'failed to fetch',
      'failed to complete'
    ]
  } = options;

  let lastError: any;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      attempt++;

      // Check if we've exhausted retries
      if (attempt >= maxRetries) {
        break;
      }

      // Determine if this error is retryable
      const isRetryable = isRetryableError(error, retryableStatuses, retryableErrorMessages);
      
      if (!isRetryable) {
        // Don't retry if it's not a network/server error
        break;
      }

      // Calculate backoff delay with jitter
      const delay = Math.min(
        initialDelayMs * Math.pow(backoffFactor, attempt - 1),
        maxDelayMs
      );
      
      // Add jitter to avoid thundering herd problem
      const jitteredDelay = delay * (0.5 + Math.random() * 0.5);

      // Notify about retry if callback provided
      if (onRetry) {
        onRetry(error, attempt);
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, jitteredDelay));
    }
  }

  // If we got here, we've exhausted retries or hit a non-retryable error
  throw lastError;
}

// Helper to determine if an error is retryable
function isRetryableError(
  error: any,
  retryableStatuses: number[],
  retryableErrorMessages: string[]
): boolean {
  // Check for HTTP status code in error
  if (error.status && retryableStatuses.includes(error.status)) {
    return true;
  }

  // Check for error message patterns
  const errorMessage = error.message?.toLowerCase() || '';
  return retryableErrorMessages.some(msg => errorMessage.includes(msg.toLowerCase()));
}

/**
 * Special version specifically for Supabase auth operations
 */
export async function retrySupabaseAuth<T>(
  authOperation: (supabase: ReturnType<typeof createClientComponentClient>) => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const supabase = createClientComponentClient();
  
  return withSupabaseRetry(
    () => authOperation(supabase),
    options
  );
}