# User Management System

## Overview

The user management system provides comprehensive administrative controls for managing users, roles, and permissions within the Pathology Bites platform. It includes safety measures to prevent unauthorized actions and accidental self-modification.

## Features

### User Table Display
- **User Information**: Name, email, role, user type, status, and join date
- **Role Badges**: Color-coded role indicators without hover effects
- **Status Indicators**: Visual status badges (Active, Inactive, Suspended)
- **Join Date**: Formatted display of when users joined the platform

### Role Management
- **Available Roles**: Admin, Creator, Reviewer, User
- **Role Change Dialog**: Confirmation-based role changes with Cancel/Confirm buttons
- **Permission-Based Access**: Only admin users can modify roles
- **Self-Modification Prevention**: Users cannot change their own role

### Status Management
- **Available Statuses**: Active, Inactive, Suspended
- **Status Change Dialog**: Confirmation-based status changes with Cancel/Confirm buttons
- **Admin-Only Access**: Only admin users can modify user status
- **Self-Modification Prevention**: Users cannot change their own status

### User Deletion
- **Delete Confirmation**: Warning dialog with contextual messages
- **Safety Checks**: Users cannot delete their own account
- **Admin-Only Access**: Only admin users can delete other users
- **Permanent Action Warning**: Clear indication that deletion cannot be undone

## Safety Features

### Access Control
- **Admin-Only Actions**: All user management actions restricted to admin users
- **Hidden Actions Column**: Non-admin users don't see management options
- **Permission Validation**: Multiple layers of permission checks

### Self-Modification Prevention
- **Role Changes**: Users cannot modify their own role
- **Status Changes**: Users cannot modify their own status
- **Account Deletion**: Users cannot delete their own account
- **Contextual Messages**: Clear explanations when actions are restricted

### UI Safety Indicators
- **Disabled States**: Visual indication when actions are not allowed
- **Contextual Dialogs**: Different messages based on the attempted action
- **Permission-Based Rendering**: UI elements only shown when appropriate

## API Endpoints

### GET /api/admin/users
Retrieves paginated list of users with filtering and search capabilities.

**Query Parameters:**
- `page`: Page number (default: 0)
- `pageSize`: Items per page (default: 10)
- `search`: Search term for name/email
- `role`: Filter by role (all, admin, creator, reviewer, user)
- `status`: Filter by status (all, active, inactive, suspended)

**Response:**
```json
{
  "users": [...],
  "totalUsers": 150,
  "totalPages": 15,
  "currentPage": 0
}
```

### PATCH /api/admin/users
Updates user role or status.

**Request Body:**
```json
{
  "userId": "uuid",
  "updates": {
    "role": "admin|creator|reviewer|user",
    "status": "active|inactive|suspended"
  }
}
```

### DELETE /api/admin/users
Deletes a user account.

**Request Body:**
```json
{
  "userId": "uuid"
}
```

**Safety Checks:**
- Prevents self-deletion
- Admin-only access
- Removes user from both database and auth system

## Component Architecture

### UsersTable Component
Main component handling user display and management actions.

**Key Features:**
- Pagination and filtering
- Search functionality
- Role-based action visibility
- Safety check implementations

**State Management:**
- User list and pagination state
- Dialog visibility states
- Pending changes for confirmations
- Loading and updating states

### Dialog Components
- **Role Change Dialog**: Confirmation-based role updates
- **Status Change Dialog**: Confirmation-based status updates
- **Delete Confirmation Dialog**: Warning and confirmation for user deletion

**Styling:**
- Blurry background overlays (`backdrop-blur-md bg-black/20`)
- Consistent with image management dialogs
- Proper button states and loading indicators

## Security Considerations

### Authentication & Authorization
- All endpoints require admin authentication
- Role verification on both client and server
- JWT token validation for API access

### Data Protection
- User data sanitization
- Secure deletion processes
- Audit trail considerations

### UI Security
- Client-side permission checks
- Server-side validation backup
- Graceful degradation for unauthorized users

## Usage Guidelines

### For Administrators
1. **Changing User Roles**: Select user → Actions → Change Role → Select new role → Confirm
2. **Updating User Status**: Select user → Actions → Change Status → Select new status → Confirm
3. **Deleting Users**: Select user → Actions → Delete User → Read warning → Confirm deletion

### Safety Reminders
- Always verify user identity before making changes
- Cannot undo user deletions
- Cannot modify your own account
- Role changes affect user permissions immediately

## Technical Implementation

### Permission Checks
```typescript
const canModifyUser = (targetUser: User) => {
  return isAdmin && currentUser?.id !== targetUser.id
}

const canDeleteUser = (targetUser: User) => {
  return isAdmin && currentUser?.id !== targetUser.id
}
```

### Dialog Pattern
All management dialogs follow a consistent pattern:
- Blurry background overlay
- Confirmation-based actions
- Loading states during operations
- Error handling and user feedback

### API Safety
- Self-modification prevention at API level
- Admin role verification
- Proper error responses for unauthorized actions

## Future Enhancements

### Potential Improvements
- Bulk user operations
- User activity logs
- Advanced filtering options
- Export user data functionality
- User invitation system

### Audit Trail
Consider implementing comprehensive audit logging for:
- Role changes
- Status updates
- User deletions
- Failed permission attempts
