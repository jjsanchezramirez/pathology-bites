// src/shared/hooks/__tests__/use-user-role.test.ts
import { renderHook, waitFor } from '@testing-library/react'
import { useUserRole } from '../use-user-role'
import { useAuthStatus } from '@/features/auth/hooks/use-auth-status'
import { createClient } from '@/shared/services/client'

// Mock dependencies
jest.mock('@/features/auth/hooks/use-auth-status')
jest.mock('@/shared/services/client')

const mockUseAuthStatus = useAuthStatus as jest.MockedFunction<typeof useAuthStatus>
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>

describe('useUserRole', () => {
  let mockSupabase: any

  beforeEach(() => {
    jest.clearAllMocks()
    mockSupabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn()
          })
        })
      })
    }
    mockCreateClient.mockReturnValue(mockSupabase)
  })

  it('should return null role when user is not authenticated', async () => {
    mockUseAuthStatus.mockReturnValue({
      user: null,
      isLoading: false,
      session: null,
      isAuthenticated: false,
      error: null,
      isHydrated: true,
      securityRisk: 'low',
      refreshAuth: jest.fn(),
      retry: jest.fn()
    })

    const { result } = renderHook(() => useUserRole())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.role).toBe(null)
    expect(result.current.isAdmin).toBe(false)
    expect(result.current.isReviewer).toBe(false)
    expect(result.current.isAdminOrReviewer).toBe(false)
  })

  it('should return admin role from user metadata', async () => {
    const mockUser = {
      id: 'user-id',
      email: 'admin@example.com',
      user_metadata: { role: 'admin' },
      app_metadata: {},
      aud: 'authenticated',
      created_at: '2023-01-01T00:00:00Z'
    }

    mockUseAuthStatus.mockReturnValue({
      user: mockUser,
      isLoading: false,
      session: null,
      isAuthenticated: true,
      error: null,
      isHydrated: true,
      securityRisk: 'low',
      refreshAuth: jest.fn(),
      retry: jest.fn()
    })

    const { result } = renderHook(() => useUserRole())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.role).toBe('admin')
    expect(result.current.isAdmin).toBe(true)
    expect(result.current.isReviewer).toBe(false)
    expect(result.current.isAdminOrReviewer).toBe(true)
  })

  it('should return reviewer role from database when metadata is not available', async () => {
    const mockUser = {
      id: 'user-id',
      email: 'reviewer@example.com',
      user_metadata: {},
      app_metadata: {},
      aud: 'authenticated',
      created_at: '2023-01-01T00:00:00Z'
    }

    mockUseAuthStatus.mockReturnValue({
      user: mockUser,
      isLoading: false,
      session: null,
      isAuthenticated: true,
      error: null,
      isHydrated: true,
      securityRisk: 'low',
      refreshAuth: jest.fn(),
      retry: jest.fn()
    })

    mockSupabase.from().select().eq().single.mockResolvedValue({
      data: { role: 'reviewer' },
      error: null
    })

    const { result } = renderHook(() => useUserRole())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.role).toBe('reviewer')
    expect(result.current.isAdmin).toBe(false)
    expect(result.current.isReviewer).toBe(true)
    expect(result.current.isAdminOrReviewer).toBe(true)
  })

  it('should check permissions correctly', async () => {
    const mockUser = {
      id: 'user-id',
      email: 'admin@example.com',
      user_metadata: { role: 'admin' },
      app_metadata: {},
      aud: 'authenticated',
      created_at: '2023-01-01T00:00:00Z'
    }

    mockUseAuthStatus.mockReturnValue({
      user: mockUser,
      isLoading: false,
      session: null,
      isAuthenticated: true,
      error: null,
      isHydrated: true,
      securityRisk: 'low',
      refreshAuth: jest.fn(),
      retry: jest.fn()
    })

    const { result } = renderHook(() => useUserRole())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // Admin should have access to admin-only features
    expect(result.current.canAccess('users.manage')).toBe(true)
    expect(result.current.canAccess('questions.review')).toBe(true)
    expect(result.current.canAccess('settings.manage')).toBe(true)
  })

  it('should handle database errors gracefully', async () => {
    const mockUser = {
      id: 'user-id',
      email: 'user@example.com',
      user_metadata: {},
      app_metadata: {},
      aud: 'authenticated',
      created_at: '2023-01-01T00:00:00Z'
    }

    mockUseAuthStatus.mockReturnValue({
      user: mockUser,
      isLoading: false,
      session: null,
      isAuthenticated: true,
      error: null,
      isHydrated: true,
      securityRisk: 'low',
      refreshAuth: jest.fn(),
      retry: jest.fn()
    })

    mockSupabase.from().select().eq().single.mockResolvedValue({
      data: null,
      error: { message: 'Database error' }
    })

    const { result } = renderHook(() => useUserRole())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.role).toBe('user') // Should fallback to 'user'
    expect(result.current.error).toBe('Database error')
  })

  it('should restrict reviewer permissions correctly', async () => {
    const mockUser = {
      id: 'user-id',
      email: 'reviewer@example.com',
      user_metadata: { role: 'reviewer' },
      app_metadata: {},
      aud: 'authenticated',
      created_at: '2023-01-01T00:00:00Z'
    }

    mockUseAuthStatus.mockReturnValue({
      user: mockUser,
      isLoading: false,
      session: null,
      isAuthenticated: true,
      error: null,
      isHydrated: true,
      securityRisk: 'low',
      refreshAuth: jest.fn(),
      retry: jest.fn()
    })

    const { result } = renderHook(() => useUserRole())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // Reviewer should have access to review features but not admin features
    expect(result.current.canAccess('questions.review')).toBe(true)
    expect(result.current.canAccess('questions.view')).toBe(true)
    expect(result.current.canAccess('users.manage')).toBe(false)
    expect(result.current.canAccess('settings.manage')).toBe(false)
    expect(result.current.canAccess('images.manage')).toBe(false)
  })
})
