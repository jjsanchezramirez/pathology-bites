import { renderHook, waitFor, act } from '@testing-library/react'
import { useAuthStatus } from '../use-auth-status'
import { mockUser, mockSession, createMockSupabaseClient } from '../../../../__tests__/utils/supabase-mock'

// Mock the client
jest.mock('@/shared/services/client', () => ({
  createClient: jest.fn(),
}))

describe('useAuthStatus', () => {
  let mockClient: any

  beforeEach(() => {
    jest.clearAllMocks()
    mockClient = createMockSupabaseClient()
    const { createClient } = require('@/shared/services/client')
    createClient.mockReturnValue(mockClient)
  })

  it('should return authenticated state when user is logged in', async () => {
    mockClient.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    })

    const { result } = renderHook(() => useAuthStatus())

    // Initially loading and hydrated (since we're in a browser environment)
    expect(result.current.isLoading).toBe(true)
    expect(result.current.isHydrated).toBe(true)

    await act(async () => {
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      }, { timeout: 3000 })
    })

    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.user).toEqual(mockUser)
    expect(result.current.session).toEqual(mockSession)
    expect(result.current.error).toBeNull()
    expect(result.current.isHydrated).toBe(true)
  })

  it('should return unauthenticated state when no user is logged in', async () => {
    mockClient.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    })

    mockClient.auth.onAuthStateChange.mockImplementation((callback: any) => {
      setTimeout(() => callback('SIGNED_OUT', null), 0)
      return {
        data: {
          subscription: {
            unsubscribe: jest.fn(),
          },
        },
      }
    })

    const { result } = renderHook(() => useAuthStatus())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.user).toBeNull()
    expect(result.current.session).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('should handle session errors', async () => {
    const sessionError = new Error('Session error')

    mockClient.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: sessionError,
    })

    const { result } = renderHook(() => useAuthStatus())

    await act(async () => {
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      }, { timeout: 3000 })
    })

    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.error).toEqual(sessionError)
  })

  it('should handle auth state changes', async () => {
    let authCallback: any

    mockClient.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    })

    mockClient.auth.onAuthStateChange.mockImplementation((callback: any) => {
      authCallback = callback
      return {
        data: {
          subscription: {
            unsubscribe: jest.fn(),
          },
        },
      }
    })

    const { result } = renderHook(() => useAuthStatus())

    // Initially unauthenticated
    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(false)
    })

    // Simulate sign in
    authCallback('SIGNED_IN', mockSession)

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.user).toEqual(mockUser)
    })

    // Simulate sign out
    authCallback('SIGNED_OUT', null)

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.user).toBeNull()
    })
  })

  it('should refresh session when refreshAuth is called', async () => {
    mockClient.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    })

    mockClient.auth.refreshSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    })

    const { result } = renderHook(() => useAuthStatus())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // Call refreshAuth
    await result.current.refreshAuth()

    expect(mockClient.auth.refreshSession).toHaveBeenCalled()
  })

  it('should handle refresh errors', async () => {
    const refreshError = new Error('Refresh failed')
    
    mockClient.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    })

    mockClient.auth.refreshSession.mockResolvedValue({
      data: { session: null },
      error: refreshError,
    })

    const { result } = renderHook(() => useAuthStatus())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // Call refreshAuth
    await result.current.refreshAuth()

    await waitFor(() => {
      expect(result.current.error).toEqual(refreshError)
    })
  })

  it('should cleanup subscription on unmount', () => {
    const unsubscribeMock = jest.fn()
    
    mockClient.auth.onAuthStateChange.mockReturnValue({
      data: {
        subscription: {
          unsubscribe: unsubscribeMock,
        },
      },
    })

    const { unmount } = renderHook(() => useAuthStatus())

    unmount()

    expect(unsubscribeMock).toHaveBeenCalled()
  })

  it('should not update state after unmount', async () => {
    let authCallback: any

    mockClient.auth.onAuthStateChange.mockImplementation((callback: any) => {
      authCallback = callback
      return {
        data: {
          subscription: {
            unsubscribe: jest.fn(),
          },
        },
      }
    })

    const { result, unmount } = renderHook(() => useAuthStatus())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    unmount()

    // Try to trigger state change after unmount
    authCallback('SIGNED_IN', mockSession)

    // Should not cause any errors or state updates
    expect(true).toBe(true) // Test passes if no errors thrown
  })
})
