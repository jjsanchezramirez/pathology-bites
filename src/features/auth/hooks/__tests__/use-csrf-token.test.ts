// src/features/auth/hooks/__tests__/use-csrf-token.test.ts
import { renderHook, act, waitFor } from '@testing-library/react'
import { useCSRFToken } from '../use-csrf-token'

// Mock fetch
global.fetch = jest.fn()

describe('useCSRFToken', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(fetch as jest.Mock).mockClear()
  })

  it('should initialize with null token and not loading', () => {
    const { result } = renderHook(() => useCSRFToken())

    expect(result.current.token).toBeNull()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('should fetch token successfully', async () => {
    const mockToken = 'test-csrf-token'
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, token: mockToken }),
    })

    const { result } = renderHook(() => useCSRFToken())

    await act(async () => {
      const token = await result.current.getToken()
      expect(token).toBe(mockToken)
    })

    expect(result.current.token).toBe(mockToken)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('should return cached token on subsequent calls', async () => {
    const mockToken = 'test-csrf-token'
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, token: mockToken }),
    })

    const { result } = renderHook(() => useCSRFToken())

    // First call
    await act(async () => {
      await result.current.getToken()
    })

    // Second call should use cached token
    await act(async () => {
      const token = await result.current.getToken()
      expect(token).toBe(mockToken)
    })

    // Fetch should only be called once
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('should handle fetch errors', async () => {
    ;(fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

    const { result } = renderHook(() => useCSRFToken())

    await act(async () => {
      try {
        await result.current.getToken()
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
      }
    })

    expect(result.current.token).toBeNull()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBe('Network error')
  })

  it('should handle HTTP errors', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
    })

    const { result } = renderHook(() => useCSRFToken())

    await act(async () => {
      try {
        await result.current.getToken()
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
      }
    })

    expect(result.current.error).toBe('Failed to fetch CSRF token: 500')
  })

  it('should handle invalid response format', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: false }),
    })

    const { result } = renderHook(() => useCSRFToken())

    await act(async () => {
      try {
        await result.current.getToken()
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
      }
    })

    expect(result.current.error).toBe('Invalid CSRF token response')
  })

  it('should add token to FormData', () => {
    const { result } = renderHook(() => useCSRFToken())
    const formData = new FormData()
    const token = 'test-token'

    act(() => {
      result.current.addTokenToFormData(formData, token)
    })

    expect(formData.get('csrf-token')).toBe(token)
  })

  it('should add token to headers', () => {
    const { result } = renderHook(() => useCSRFToken())
    const headers = { 'Content-Type': 'application/json' }
    const token = 'test-token'

    let newHeaders: any
    act(() => {
      newHeaders = result.current.addTokenToHeaders(headers, token)
    })

    expect(newHeaders).toEqual({
      'Content-Type': 'application/json',
      'x-csrf-token': token,
    })
  })

  it('should clear token and error', async () => {
    const mockToken = 'test-csrf-token'
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, token: mockToken }),
    })

    const { result } = renderHook(() => useCSRFToken())

    // First get a token
    await act(async () => {
      await result.current.getToken()
    })

    expect(result.current.token).toBe(mockToken)

    // Clear token
    act(() => {
      result.current.clearToken()
    })

    expect(result.current.token).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('should set loading state correctly', async () => {
    let resolvePromise: (value: any) => void
    const promise = new Promise((resolve) => {
      resolvePromise = resolve
    })

    ;(fetch as jest.Mock).mockReturnValueOnce(promise)

    const { result } = renderHook(() => useCSRFToken())

    // Start the request
    act(() => {
      result.current.getToken()
    })

    // Should be loading
    await waitFor(() => {
      expect(result.current.isLoading).toBe(true)
    })

    // Resolve the promise
    act(() => {
      resolvePromise!({
        ok: true,
        json: async () => ({ success: true, token: 'test-token' }),
      })
    })

    // Should not be loading anymore
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
  })

  it('should make request with correct parameters', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, token: 'test-token' }),
    })

    const { result } = renderHook(() => useCSRFToken())

    await act(async () => {
      await result.current.getToken()
    })

    expect(fetch).toHaveBeenCalledWith('/api/csrf-token', {
      method: 'GET',
      credentials: 'same-origin',
      headers: {
        'Accept': 'application/json',
      },
    })
  })
})

describe('addCSRFTokenToForm utility', () => {
  it('should add CSRF token input to form', () => {
    const { addCSRFTokenToForm } = require('../use-csrf-token')
    
    // Create a mock form
    const form = document.createElement('form')
    const token = 'test-token'

    addCSRFTokenToForm(form, token)

    const input = form.querySelector('input[name="csrf-token"]') as HTMLInputElement
    expect(input).toBeTruthy()
    expect(input.type).toBe('hidden')
    expect(input.value).toBe(token)
  })

  it('should replace existing CSRF token input', () => {
    const { addCSRFTokenToForm } = require('../use-csrf-token')
    
    const form = document.createElement('form')
    
    // Add existing input
    const existingInput = document.createElement('input')
    existingInput.name = 'csrf-token'
    existingInput.value = 'old-token'
    form.appendChild(existingInput)

    const newToken = 'new-token'
    addCSRFTokenToForm(form, newToken)

    const inputs = form.querySelectorAll('input[name="csrf-token"]')
    expect(inputs).toHaveLength(1)
    expect((inputs[0] as HTMLInputElement).value).toBe(newToken)
  })
})
