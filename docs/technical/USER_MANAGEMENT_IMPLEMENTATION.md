# User Management Implementation Guide

## Architecture Overview

The user management system is built with a layered architecture ensuring security, usability, and maintainability.

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   UI Components │    │   API Routes    │    │   Database      │
│                 │    │                 │    │                 │
│ - UsersTable    │◄──►│ /api/admin/     │◄──►│ - users table   │
│ - Dialogs       │    │   users         │    │ - auth.users    │
│ - Permissions   │    │ - Auth checks   │    │ - RLS policies  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Component Structure

### Main Components

#### UsersTable (`src/features/users/components/users-table.tsx`)
Primary component handling user management interface.

**Key Responsibilities:**
- User data fetching and display
- Pagination and filtering
- Action dialogs management
- Permission-based UI rendering

**State Management:**
```typescript
// Core data state
const [users, setUsers] = useState<User[]>([])
const [loading, setLoading] = useState(true)
const [totalPages, setTotalPages] = useState(0)

// Dialog state
const [showRoleDialog, setShowRoleDialog] = useState(false)
const [showStatusDialog, setShowStatusDialog] = useState(false)
const [showDeleteDialog, setShowDeleteDialog] = useState(false)

// Pending changes for confirmation
const [pendingRole, setPendingRole] = useState<string>('')
const [pendingStatus, setPendingStatus] = useState<string>('')

// Permission state
const { user: currentUser } = useAuthStatus()
const { isAdmin } = useUserRole()
```

#### Permission Helpers
```typescript
const canModifyUser = (targetUser: User) => {
  return isAdmin && currentUser?.id !== targetUser.id
}

const canDeleteUser = (targetUser: User) => {
  return isAdmin && currentUser?.id !== targetUser.id
}
```

### Dialog Components

#### Role Change Dialog
- Uses `Dialog` component with blurry background
- Confirmation-based workflow
- Dropdown selection with all available roles
- Disabled state for unauthorized actions

#### Status Change Dialog
- Similar pattern to role dialog
- Status options: Active, Inactive, Suspended
- Confirmation required before changes

#### Delete Confirmation Dialog
- Warning-focused design
- Contextual messages for self-deletion attempts
- Destructive action styling
- Cannot be undone warning

## API Implementation

### Endpoint Structure

#### GET /api/admin/users
```typescript
// Query parameters
interface UsersQuery {
  page?: number
  pageSize?: number
  search?: string
  role?: 'all' | 'admin' | 'reviewer' | 'user'
  status?: 'all' | 'active' | 'inactive' | 'suspended'
}

// Response format
interface UsersResponse {
  users: User[]
  totalUsers: number
  totalPages: number
  currentPage: number
}
```

#### PATCH /api/admin/users
```typescript
// Request body
interface UpdateUserRequest {
  userId: string
  updates: {
    role?: 'admin' | 'reviewer' | 'user'
    status?: 'active' | 'inactive' | 'suspended'
  }
}

// Updates both database and auth metadata
```

#### DELETE /api/admin/users
```typescript
// Request body
interface DeleteUserRequest {
  userId: string
}

// Safety checks implemented:
// - Prevents self-deletion
// - Admin-only access
// - Removes from both DB and auth
```

### Security Implementation

#### Authentication Flow
```typescript
// 1. Verify user is authenticated
const { data: { user }, error: authError } = await supabase.auth.getUser()
if (authError || !user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

// 2. Verify admin role
const { data: userData, error: userError } = await supabase
  .from('users')
  .select('role')
  .eq('id', user.id)
  .single()

if (userError || userData?.role !== 'admin') {
  return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
}

// 3. Additional safety checks for specific operations
if (userId === user.id) {
  return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
}
```

## Database Schema

### Users Table Structure
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  user_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Role Definitions
- **admin**: Full system access, can manage all users
- **reviewer**: Can review questions, limited admin access
- **user**: Standard user access, no admin capabilities

### Status Definitions
- **active**: User can access the system normally
- **inactive**: User account is disabled
- **suspended**: User account is temporarily restricted

## UI/UX Patterns

### Dialog Styling
All management dialogs use consistent styling:
```typescript
<Dialog open={showDialog} onOpenChange={setShowDialog}>
  <DialogPortal>
    <DialogOverlay className="backdrop-blur-md bg-black/20" />
    <DialogContent className="sm:max-w-md">
      {/* Dialog content */}
    </DialogContent>
  </DialogPortal>
</Dialog>
```

### Permission-Based Rendering
```typescript
// Hide actions column for non-admin users
{isAdmin && (
  <TableHead className="w-[70px]"></TableHead>
)}

// Disable actions for unauthorized users
<DropdownMenuItem
  disabled={!canModifyUser(user)}
  onClick={() => handleAction(user)}
>
  Action
</DropdownMenuItem>
```

### Loading States
```typescript
// Button loading state
<Button disabled={isUpdating}>
  {isUpdating ? (
    <>
      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      Updating...
    </>
  ) : (
    'Confirm'
  )}
</Button>
```

## Error Handling

### Client-Side Error Handling
```typescript
try {
  const response = await fetch('/api/admin/users', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, updates })
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error || 'Failed to update user')
  }

  toast.success('User updated successfully')
  await loadUsers()
} catch (error) {
  console.error('Error updating user:', error)
  toast.error(error instanceof Error ? error.message : 'Failed to update user')
}
```

### Server-Side Error Responses
```typescript
// Standardized error responses
return NextResponse.json(
  { error: 'Specific error message' },
  { status: 400 | 401 | 403 | 500 }
)
```

## Testing Considerations

### Unit Tests
- Component rendering with different permission levels
- Permission helper function validation
- API endpoint security checks

### Integration Tests
- End-to-end user management workflows
- Permission enforcement across UI and API
- Error handling scenarios

### Security Tests
- Unauthorized access attempts
- Self-modification prevention
- Role escalation attempts

## Performance Optimizations

### Pagination
- Server-side pagination for large user lists
- Configurable page sizes
- Efficient database queries

### Caching
- Role information caching
- User list caching with invalidation
- Optimistic UI updates

### Loading States
- Skeleton loading for table
- Button loading states
- Progressive data loading

## Deployment Considerations

### Environment Variables
- Database connection strings
- Authentication service configuration
- Rate limiting settings

### Database Migrations
- User table schema updates
- Role and status enum updates
- Index optimizations

### Monitoring
- User management action logging
- Performance metrics
- Error rate monitoring

## Maintenance Guidelines

### Code Organization
- Feature-based folder structure
- Shared components for common patterns
- Type definitions for all interfaces

### Documentation Updates
- API documentation maintenance
- Component prop documentation
- Security guideline updates

### Regular Reviews
- Permission logic audits
- Security vulnerability assessments
- Performance optimization reviews
