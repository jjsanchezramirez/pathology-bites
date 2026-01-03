// src/shared/utils/api-client.ts
/**
 * Centralized API client with automatic CSRF token handling
 * 
 * This utility provides a fetch wrapper that automatically:
 * - Fetches and caches CSRF tokens
 * - Adds CSRF tokens to request headers for POST/PATCH/PUT/DELETE
 * - Includes credentials for authenticated requests
 * - Provides consistent error handling
 * 
 * Usage:
 * ```typescript
 * import { apiClient } from '@/shared/utils/api-client'
 * 
 * // Simple usage
 * const response = await apiClient.post('/api/admin/questions', { data })
 * 
 * // Or use the fetch wrapper directly
 * const response = await apiClient.fetch('/api/admin/questions', {
 *   method: 'POST',
 *   body: JSON.stringify(data)
 * })
 * ```
 */

const CSRF_TOKEN_ENDPOINT = '/api/public/csrf-token'
const CSRF_HEADER_NAME = 'x-csrf-token'

class APIClient {
  private csrfToken: string | null = null
  private csrfTokenPromise: Promise<string> | null = null

  /**
   * Get CSRF token with caching
   */
  private async getCSRFToken(): Promise<string> {
    // Return cached token if available
    if (this.csrfToken) {
      return this.csrfToken
    }

    // Return in-flight request if one exists
    if (this.csrfTokenPromise) {
      return this.csrfTokenPromise
    }

    // Fetch new token
    this.csrfTokenPromise = (async () => {
      try {
        const response = await fetch(CSRF_TOKEN_ENDPOINT, {
          method: 'GET',
          credentials: 'same-origin',
          headers: { 'Accept': 'application/json' }
        })

        if (!response.ok) {
          throw new Error('Failed to fetch CSRF token')
        }

        const data = await response.json()
        this.csrfToken = data.token
        return data.token
      } catch (error) {
        console.error('Error fetching CSRF token:', error)
        throw error
      } finally {
        this.csrfTokenPromise = null
      }
    })()

    return this.csrfTokenPromise
  }

  /**
   * Clear cached CSRF token (useful for testing or after auth changes)
   */
  clearToken(): void {
    this.csrfToken = null
    this.csrfTokenPromise = null
  }

  /**
   * Enhanced fetch with automatic CSRF token handling
   * Includes automatic retry on 403 CSRF errors
   */
  async fetch(url: string, options: RequestInit = {}): Promise<Response> {
    const method = options.method?.toUpperCase() || 'GET'
    const needsCSRF = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)

    // Prepare headers
    const headers = new Headers(options.headers || {})

    // Add CSRF token for state-changing requests
    if (needsCSRF) {
      const csrfToken = await this.getCSRFToken()
      headers.set(CSRF_HEADER_NAME, csrfToken)
    }

    // Ensure Content-Type is set for JSON requests
    if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }

    // Make the request with credentials
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: options.credentials || 'include',
    })

    // If we get a 403 error on a CSRF-protected request, try refreshing the token once
    if (response.status === 403 && needsCSRF) {
      try {
        const errorData = await response.clone().json()

        // Check if it's a CSRF error
        if (errorData.error?.includes('CSRF') || errorData.message?.includes('CSRF')) {
          console.warn('CSRF token validation failed, refreshing token and retrying...')

          // Clear the cached token and fetch a new one
          this.clearToken()
          const newCsrfToken = await this.getCSRFToken()
          headers.set(CSRF_HEADER_NAME, newCsrfToken)

          // Retry the request with the new token
          return fetch(url, {
            ...options,
            headers,
            credentials: options.credentials || 'include',
          })
        }
      } catch (_e) {
        // If we can't parse the error or it's not a CSRF error, return the original response
        return response
      }
    }

    return response
  }

  /**
   * Convenience method for GET requests
   */
  async get(url: string, options: RequestInit = {}): Promise<Response> {
    return this.fetch(url, { ...options, method: 'GET' })
  }

  /**
   * Convenience method for POST requests
   */
  async post(url: string, body?: any, options: RequestInit = {}): Promise<Response> {
    return this.fetch(url, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  /**
   * Convenience method for PATCH requests
   */
  async patch(url: string, body?: any, options: RequestInit = {}): Promise<Response> {
    return this.fetch(url, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  /**
   * Convenience method for PUT requests
   */
  async put(url: string, body?: any, options: RequestInit = {}): Promise<Response> {
    return this.fetch(url, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  /**
   * Convenience method for DELETE requests
   */
  async delete(url: string, body?: any, options: RequestInit = {}): Promise<Response> {
    return this.fetch(url, {
      ...options,
      method: 'DELETE',
      body: body ? JSON.stringify(body) : undefined,
    })
  }
}

// Export singleton instance
export const apiClient = new APIClient()

// Export for testing or special cases
export { APIClient }

