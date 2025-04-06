// src/lib/utils/retry-operation.ts

type RetryOptions = {
    maxRetries?: number
    delayMs?: number
    backoffFactor?: number
    retryableErrors?: string[]
  }
  
  const defaultOptions: RetryOptions = {
    maxRetries: 3,
    delayMs: 1000,
    backoffFactor: 2,
    retryableErrors: ['network', 'connection', 'timeout', 'fetch failed']
  }
  
  /**
   * Utility function for retrying operations with exponential backoff
   * Typically used for network requests that might fail temporarily
   * 
   * @param operation The async function to retry
   * @param options Retry configuration options
   * @returns The result of the operation
   */
  export async function retryOperation<T>(
    operation: () => Promise<T>,
    options?: RetryOptions
  ): Promise<T> {
    const opts = { ...defaultOptions, ...options }
    let lastError: Error | null = null
    let attempt = 0
  
    while (attempt < (opts.maxRetries || 3)) {
      try {
        return await operation()
      } catch (error) {
        attempt++
        lastError = error instanceof Error ? error : new Error(String(error))
        
        // Check if we should retry based on the error message
        const errorMessage = lastError.message.toLowerCase()
        const shouldRetry = (opts.retryableErrors || []).some(
          errType => errorMessage.includes(errType.toLowerCase())
        )
        
        // Stop retrying if it's not a retryable error or we've reached max attempts
        if (!shouldRetry || attempt >= (opts.maxRetries || 3)) {
          break
        }
        
        // Calculate delay with exponential backoff
        const delay = (opts.delayMs || 1000) * Math.pow(opts.backoffFactor || 2, attempt - 1)
        console.log(`Retry attempt ${attempt} after ${delay}ms. Error: ${lastError.message}`)
        
        // Wait before next attempt
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  
    // If we've exhausted all retries, throw the last error
    throw lastError || new Error('Operation failed after multiple attempts')
  }