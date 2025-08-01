import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { AuthProvider, useAuthContext } from '../auth-provider'
import { mockUser, mockSession, createMockSupabaseClient } from '../../../../__tests__/utils/supabase-mock'

// Mock the client
jest.mock('@/shared/services/client', () => ({
  createClient: jest.fn(),
}))

// Test component to access auth context
function TestComponent() {
  const { user, session, isLoading, isAuthenticated } = useAuthContext()
  
  return (
    <div>
      <div data-testid="loading">{isLoading ? 'loading' : 'loaded'}</div>
      <div data-testid="authenticated">{isAuthenticated ? 'authenticated' : 'unauthenticated'}</div>
      <div data-testid="user-email">{user?.email || 'no-email'}</div>
      <div data-testid="session-exists">{session ? 'has-session' : 'no-session'}</div>
    </div>
  )
}

describe('AuthProvider', () => {
  let mockClient: any

  beforeEach(() => {
    jest.clearAllMocks()
    mockClient = createMockSupabaseClient()
    const { createClient } = require('@/shared/services/client')
    createClient.mockReturnValue(mockClient)
  })

  it('should provide authenticated state when user is logged in', async () => {
    mockClient.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    })

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    // Initially loading
    expect(screen.getByTestId('loading')).toHaveTextContent('loading')

    // Wait for auth state to settle
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded')
    })

    expect(screen.getByTestId('authenticated')).toHaveTextContent('authenticated')
    expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com')
    expect(screen.getByTestId('session-exists')).toHaveTextContent('has-session')
  })

  it('should provide unauthenticated state when no user is logged in', async () => {
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

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded')
    })

    expect(screen.getByTestId('authenticated')).toHaveTextContent('unauthenticated')
    expect(screen.getByTestId('user-email')).toHaveTextContent('no-email')
    expect(screen.getByTestId('session-exists')).toHaveTextContent('no-session')
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

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    // Initially unauthenticated
    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('unauthenticated')
    })

    // Simulate sign in
    authCallback('SIGNED_IN', mockSession)

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('authenticated')
      expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com')
    })

    // Simulate sign out
    authCallback('SIGNED_OUT', null)

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('unauthenticated')
      expect(screen.getByTestId('user-email')).toHaveTextContent('no-email')
    })
  })

  it('should handle session errors gracefully', async () => {
    mockClient.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'Session error' },
    })

    mockClient.auth.onAuthStateChange.mockImplementation((callback: any) => {
      // Don't trigger any auth state changes for error case
      return {
        data: {
          subscription: {
            unsubscribe: jest.fn(),
          },
        },
      }
    })

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded')
    })

    expect(screen.getByTestId('authenticated')).toHaveTextContent('unauthenticated')
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

    const { unmount } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    unmount()

    expect(unsubscribeMock).toHaveBeenCalled()
  })

  it('should handle rapid auth state changes', async () => {
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

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    // Simulate rapid state changes
    authCallback('SIGNED_IN', mockSession)
    authCallback('SIGNED_OUT', null)
    authCallback('SIGNED_IN', mockSession)

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('authenticated')
    })
  })
})
