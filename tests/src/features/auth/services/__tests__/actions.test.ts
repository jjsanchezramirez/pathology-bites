import { signup, login, signInWithGoogle } from '../actions'
import { createMockServerClient, mockUser, mockAuthSuccess, mockAuthError } from '../../../../__tests__/utils/supabase-mock'
import { createMockFormData, setupNavigationMocks, resetAllMocks } from '../../../../__tests__/utils/auth-test-utils'

// Mock the server client
jest.mock('@/shared/services/server', () => ({
  createClient: jest.fn(),
}))

// Mock revalidatePath
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

// Mock redirect
jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}))

describe('Auth Actions', () => {
  let mockClient: any
  let mockRedirect: jest.Mock

  beforeEach(() => {
    resetAllMocks()

    // Get the mocked redirect function
    const { redirect } = require('next/navigation')
    mockRedirect = redirect

    mockClient = createMockServerClient()
    const { createClient } = require('@/shared/services/server')
    createClient.mockResolvedValue(mockClient)
  })

  describe('signup', () => {
    it('should successfully sign up a new user', async () => {
      const formData = createMockFormData({
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
        userType: 'student',
      })

      mockClient.auth.signUp.mockResolvedValue({ error: null })

      await signup(formData)

      expect(mockClient.auth.signUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        options: {
          data: {
            first_name: 'Test',
            last_name: 'User',
            user_type: 'student',
          },
          emailRedirectTo: 'http://localhost:3000/api/auth/confirm',
        },
      })

      expect(mockRedirect).toHaveBeenCalledWith('/verify-email?email=test%40example.com')
    })

    it('should handle existing user error', async () => {
      const formData = createMockFormData({
        email: 'existing@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
        userType: 'student',
      })

      mockClient.auth.signUp.mockResolvedValue({
        error: { message: 'User already registered' },
      })

      await signup(formData)

      expect(mockRedirect).toHaveBeenCalledWith('/signup?error=An account with this email already exists')
    })

    it('should handle general signup errors', async () => {
      const formData = createMockFormData({
        email: 'test@example.com',
        password: 'weak',
        firstName: 'Test',
        lastName: 'User',
        userType: 'student',
      })

      mockClient.auth.signUp.mockResolvedValue({
        error: { message: 'Password is too weak' },
      })

      await signup(formData)

      expect(mockRedirect).toHaveBeenCalledWith('/signup?error=Password%20is%20too%20weak')
    })
  })

  describe('login', () => {
    it('should successfully log in a user and redirect to user dashboard', async () => {
      const formData = createMockFormData({
        email: 'test@example.com',
        password: 'password123',
      })

      mockClient.auth.signInWithPassword.mockResolvedValue({
        error: null,
        data: { user: mockUser },
      })

      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { role: 'user' },
              error: null,
            }),
          }),
        }),
      })

      await login(formData)

      expect(mockClient.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      })

      expect(mockRedirect).toHaveBeenCalledWith('/dashboard')
    })

    it('should redirect admin users to admin dashboard', async () => {
      const formData = createMockFormData({
        email: 'admin@example.com',
        password: 'password123',
      })

      mockClient.auth.signInWithPassword.mockResolvedValue({
        error: null,
        data: { user: mockUser },
      })

      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { role: 'admin' },
              error: null,
            }),
          }),
        }),
      })

      await login(formData)

      expect(mockRedirect).toHaveBeenCalledWith('/admin/dashboard')
    })

    it('should handle invalid credentials', async () => {
      const formData = createMockFormData({
        email: 'test@example.com',
        password: 'wrongpassword',
      })

      mockClient.auth.signInWithPassword.mockResolvedValue({
        error: { message: 'Invalid login credentials' },
        data: { user: null },
      })

      await login(formData)

      expect(mockRedirect).toHaveBeenCalledWith('/login?error=Invalid email or password')
    })

    it('should handle unconfirmed email', async () => {
      const formData = createMockFormData({
        email: 'unconfirmed@example.com',
        password: 'password123',
      })

      mockClient.auth.signInWithPassword.mockResolvedValue({
        error: { message: 'Email not confirmed' },
        data: { user: null },
      })

      await login(formData)

      expect(mockRedirect).toHaveBeenCalledWith('/verify-email?email=unconfirmed%40example.com')
    })

    it('should handle redirect parameter', async () => {
      const formData = createMockFormData({
        email: 'test@example.com',
        password: 'password123',
        redirect: '/protected-page',
      })

      mockClient.auth.signInWithPassword.mockResolvedValue({
        error: null,
        data: { user: mockUser },
      })

      await login(formData)

      expect(mockRedirect).toHaveBeenCalledWith('/protected-page')
    })
  })

  describe('signInWithGoogle', () => {
    it('should initiate Google OAuth flow', async () => {
      mockClient.auth.signInWithOAuth.mockResolvedValue({
        data: { url: 'https://accounts.google.com/oauth/authorize?...' },
        error: null,
      })

      await signInWithGoogle()

      expect(mockClient.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: {
          redirectTo: 'http://localhost:3000/api/auth/callback',
        },
      })

      expect(mockRedirect).toHaveBeenCalledWith('https://accounts.google.com/oauth/authorize?...')
    })

    it('should handle OAuth errors', async () => {
      mockClient.auth.signInWithOAuth.mockResolvedValue({
        data: { url: null },
        error: { message: 'OAuth provider error' },
      })

      await signInWithGoogle()

      expect(mockRedirect).toHaveBeenCalledWith('/login?error=OAuth%20provider%20error')
    })
  })
})
