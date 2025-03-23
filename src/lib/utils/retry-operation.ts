// src/lib/utils/retry-operation.ts
type RetryOptions = {
    maxRetries: number;
    delayMs: number;
    backoffFactor: number;
    retryableErrors?: string[];
  }
  
  /**
   * Retries an operation with exponential backoff
   */
  export async function retryOperation<T>(
    operation: () => Promise<T>,
    options: RetryOptions
  ): Promise<T> {
    const { maxRetries, delayMs, backoffFactor, retryableErrors } = options;
    
    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // If retryableErrors is specified, only retry for those specific errors
        if (retryableErrors && retryableErrors.length > 0) {
          const shouldRetry = retryableErrors.some(errMsg => 
            lastError?.message.includes(errMsg)
          );
          
          if (!shouldRetry) {
            throw lastError;
          }
        }
        
        // Don't delay on the last attempt since we're about to throw
        if (attempt < maxRetries - 1) {
          const delay = delayMs * Math.pow(backoffFactor, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // If we've exhausted all retries, throw the last error
    throw lastError;
  }