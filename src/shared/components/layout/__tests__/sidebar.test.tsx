// src/shared/components/layout/__tests__/sidebar.test.tsx
import { render, screen } from '@testing-library/react'
import { usePathname } from 'next/navigation'
import { AdminSidebar } from '../sidebar'
import { useUserRole } from '@/shared/hooks/use-user-role'

// Mock dependencies
jest.mock('next/navigation')
jest.mock('@/shared/hooks/use-user-role')
jest.mock('../sidebar-auth-status', () => ({
  SidebarAuthStatus: ({ isCollapsed }: { isCollapsed: boolean }) => (
    <div data-testid="auth-status">Auth Status - {isCollapsed ? 'collapsed' : 'expanded'}</div>
  )
}))

const mockUsePathname = usePathname as jest.MockedFunction<typeof usePathname>
const mockUseUserRole = useUserRole as jest.MockedFunction<typeof useUserRole>

describe('AdminSidebar', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUsePathname.mockReturnValue('/admin/dashboard')
  })

  it('should render all navigation items for admin user', () => {
    mockUseUserRole.mockReturnValue({
      role: 'admin',
      isLoading: false,
      error: null,
      canAccess: jest.fn().mockReturnValue(true),
      isAdmin: true,
      isReviewer: false,
      isAdminOrReviewer: true
    })

    render(<AdminSidebar isCollapsed={false} />)

    // Check that all navigation items are present
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Questions')).toBeInTheDocument()
    expect(screen.getByText('Review Drafts')).toBeInTheDocument()
    expect(screen.getByText('Review Queue')).toBeInTheDocument()
    expect(screen.getByText('Question Management')).toBeInTheDocument()
    expect(screen.getByText('Inquiries')).toBeInTheDocument()
    expect(screen.getByText('Users')).toBeInTheDocument()
    expect(screen.getByText('Images')).toBeInTheDocument()
    expect(screen.getByText('Analytics')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('should filter navigation items for reviewer user', () => {
    mockUseUserRole.mockReturnValue({
      role: 'reviewer',
      isLoading: false,
      error: null,
      canAccess: jest.fn((permission: string) => {
        // Reviewer can access review features but not admin features
        return ['dashboard.view', 'questions.view', 'questions.review'].includes(permission)
      }),
      isAdmin: false,
      isReviewer: true,
      isAdminOrReviewer: true
    })

    render(<AdminSidebar isCollapsed={false} />)

    // Should show reviewer-accessible items
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Questions')).toBeInTheDocument()
    expect(screen.getByText('Review Drafts')).toBeInTheDocument()
    expect(screen.getByText('Review Queue')).toBeInTheDocument()

    // Should not show admin-only items
    expect(screen.queryByText('Question Management')).not.toBeInTheDocument()
    expect(screen.queryByText('Inquiries')).not.toBeInTheDocument()
    expect(screen.queryByText('Users')).not.toBeInTheDocument()
    expect(screen.queryByText('Images')).not.toBeInTheDocument()
    expect(screen.queryByText('Analytics')).not.toBeInTheDocument()
    expect(screen.queryByText('Settings')).not.toBeInTheDocument()
  })

  it('should highlight active navigation item', () => {
    mockUsePathname.mockReturnValue('/admin/questions')
    mockUseUserRole.mockReturnValue({
      role: 'admin',
      isLoading: false,
      error: null,
      canAccess: jest.fn().mockReturnValue(true),
      isAdmin: true,
      isReviewer: false,
      isAdminOrReviewer: true
    })

    render(<AdminSidebar isCollapsed={false} />)

    const questionsLink = screen.getByText('Questions').closest('a')
    expect(questionsLink).toHaveClass('bg-slate-800')
  })

  it('should render collapsed sidebar correctly', () => {
    mockUseUserRole.mockReturnValue({
      role: 'admin',
      isLoading: false,
      error: null,
      canAccess: jest.fn().mockReturnValue(true),
      isAdmin: true,
      isReviewer: false,
      isAdminOrReviewer: true
    })

    render(<AdminSidebar isCollapsed={true} />)

    // Logo text should not be visible when collapsed
    expect(screen.queryByText('Pathology Bites')).not.toBeInTheDocument()
    
    // Navigation items should still be present but text might be hidden
    const dashboardLink = screen.getByTitle('Dashboard')
    expect(dashboardLink).toBeInTheDocument()
  })

  it('should show loading state correctly', () => {
    mockUseUserRole.mockReturnValue({
      role: null,
      isLoading: true,
      error: null,
      canAccess: jest.fn().mockReturnValue(false),
      isAdmin: false,
      isReviewer: false,
      isAdminOrReviewer: false
    })

    render(<AdminSidebar isCollapsed={false} />)

    // During loading, all items should be shown
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Users')).toBeInTheDocument()
  })

  it('should disable admin-only items for non-admin users', () => {
    mockUseUserRole.mockReturnValue({
      role: 'reviewer',
      isLoading: false,
      error: null,
      canAccess: jest.fn((permission: string) => {
        return ['dashboard.view', 'questions.view', 'questions.review'].includes(permission)
      }),
      isAdmin: false,
      isReviewer: true,
      isAdminOrReviewer: true
    })

    render(<AdminSidebar isCollapsed={false} />)

    // Check that admin-only items are filtered out
    expect(screen.queryByText('Users')).not.toBeInTheDocument()
    expect(screen.queryByText('Settings')).not.toBeInTheDocument()
  })

  it('should render auth status component', () => {
    mockUseUserRole.mockReturnValue({
      role: 'admin',
      isLoading: false,
      error: null,
      canAccess: jest.fn().mockReturnValue(true),
      isAdmin: true,
      isReviewer: false,
      isAdminOrReviewer: true
    })

    render(<AdminSidebar isCollapsed={false} />)

    expect(screen.getByTestId('auth-status')).toBeInTheDocument()
    expect(screen.getByText('Auth Status - expanded')).toBeInTheDocument()
  })

  it('should pass collapsed state to auth status', () => {
    mockUseUserRole.mockReturnValue({
      role: 'admin',
      isLoading: false,
      error: null,
      canAccess: jest.fn().mockReturnValue(true),
      isAdmin: true,
      isReviewer: false,
      isAdminOrReviewer: true
    })

    render(<AdminSidebar isCollapsed={true} />)

    expect(screen.getByText('Auth Status - collapsed')).toBeInTheDocument()
  })
})
