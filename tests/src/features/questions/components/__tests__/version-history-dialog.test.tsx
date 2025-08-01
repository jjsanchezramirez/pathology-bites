import { render, screen, waitFor } from '@testing-library/react'
import { VersionHistoryDialog } from '../version-history-dialog'

// Mock fetch
global.fetch = jest.fn()

// Mock Sonner toast
jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
  },
}))

// Mock Supabase client
jest.mock('@/shared/services/client', () => ({
  createClient: () => ({
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: 'test-user' } }, error: null })
    }
  })
}))

describe('VersionHistoryDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders dialog when open', () => {
    render(
      <VersionHistoryDialog
        questionId="test-question-id"
        questionTitle="Test Question"
        open={true}
        onOpenChange={() => {}}
      />
    )

    expect(screen.getByText('Version History')).toBeInTheDocument()
    expect(screen.getByText('Version history for "Test Question"')).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(
      <VersionHistoryDialog
        questionId="test-question-id"
        questionTitle="Test Question"
        open={false}
        onOpenChange={() => {}}
      />
    )

    expect(screen.queryByText('Version History')).not.toBeInTheDocument()
  })

  it('shows loading state initially', () => {
    render(
      <VersionHistoryDialog
        questionId="test-question-id"
        questionTitle="Test Question"
        open={true}
        onOpenChange={() => {}}
      />
    )

    // Should show loading skeletons
    expect(document.querySelectorAll('.animate-pulse')).toHaveLength(3)
  })

  it('fetches version history when opened', async () => {
    const mockVersions = [
      {
        id: 'version-1',
        version_major: 1,
        version_minor: 1,
        version_patch: 0,
        version_string: '1.1.0',
        update_type: 'minor',
        change_summary: 'Updated teaching point',
        question_data: {
          title: 'Updated Question',
          stem: 'Updated stem',
          teaching_point: 'Updated teaching point'
        },
        created_at: '2024-01-02T00:00:00Z',
        changed_by: 'user-1',
        changer: { first_name: 'John', last_name: 'Doe', email: 'john@example.com' }
      },
      {
        id: 'version-2',
        version_major: 1,
        version_minor: 0,
        version_patch: 0,
        version_string: '1.0.0',
        update_type: 'major',
        change_summary: 'Initial version',
        question_data: {
          title: 'Original Question',
          stem: 'Original stem',
          teaching_point: 'Original teaching point'
        },
        created_at: '2024-01-01T00:00:00Z',
        changed_by: 'user-1',
        changer: { first_name: 'John', last_name: 'Doe', email: 'john@example.com' }
      }
    ]

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        versions: mockVersions
      })
    })

    render(
      <VersionHistoryDialog
        questionId="test-question-id"
        questionTitle="Test Question"
        open={true}
        onOpenChange={() => {}}
      />
    )

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/questions/test-question-id/version')
    })

    await waitFor(() => {
      expect(screen.getByText('v1.1.0')).toBeInTheDocument()
      expect(screen.getByText('v1.0.0')).toBeInTheDocument()
    })
  })

  it('shows empty state when no versions exist', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        versions: []
      })
    })

    render(
      <VersionHistoryDialog
        questionId="test-question-id"
        questionTitle="Test Question"
        open={true}
        onOpenChange={() => {}}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('No version history available')).toBeInTheDocument()
    })
  })

  it('handles API errors gracefully', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      text: () => Promise.resolve('API Error')
    })

    render(
      <VersionHistoryDialog
        questionId="test-question-id"
        questionTitle="Test Question"
        open={true}
        onOpenChange={() => {}}
      />
    )

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })
  })
})
