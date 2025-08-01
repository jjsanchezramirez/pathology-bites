// src/features/users/components/users-table.tsx
'use client'

import { useState, useCallback, useEffect, memo } from 'react'
import { toast } from 'sonner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table'
import { Input } from '@/shared/components/ui/input'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import {
  Search,
  Loader2,
  MoreVertical,
  Shield,
  UserCheck,
  GraduationCap,
  RefreshCw,
  Trash2
} from 'lucide-react'
import { format } from 'date-fns'
import { useUserRole } from '@/shared/hooks/use-user-role'
import { useAuthStatus } from '@/features/auth/hooks/use-auth-status'

interface User {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  role: string
  user_type: string
  status: string
  created_at: string
  updated_at: string
}

const PAGE_SIZE = 10

const roleConfig = {
  admin: { label: 'Admin', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' },
  creator: { label: 'Creator', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300' },
  reviewer: { label: 'Reviewer', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300' },
  user: { label: 'User', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-300' },
}

const statusConfig = {
  active: { label: 'Active', color: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' },
  inactive: { label: 'Inactive', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-300' },
  suspended: { label: 'Suspended', color: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' },
}

const userTypeConfig = {
  student: 'Student',
  resident: 'Resident',
  fellow: 'Fellow',
  attending: 'Attending',
  other: 'Other',
}

interface UserRowProps {
  user: User
  isAdmin: boolean
  onRoleChange: (user: User) => void
  onStatusChange: (user: User) => void
  onTypeChange: (user: User) => void
  onDelete: (user: User) => void
  canModifyUser: (user: User) => boolean
  canDeleteUser: (user: User) => boolean
  getDisplayName: (user: User) => string
}

const UserRow = memo(function UserRow({
  user,
  isAdmin,
  onRoleChange,
  onStatusChange,
  onTypeChange,
  onDelete,
  canModifyUser,
  canDeleteUser,
  getDisplayName
}: UserRowProps) {
  return (
    <TableRow key={user.id}>
      <TableCell>
        <div>
          <div className="font-medium">{getDisplayName(user)}</div>
          <div className="text-sm text-muted-foreground">{user.email}</div>
        </div>
      </TableCell>
      <TableCell>
        <div className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${roleConfig[user.role as keyof typeof roleConfig]?.color || ''}`}>
          {roleConfig[user.role as keyof typeof roleConfig]?.label || user.role}
        </div>
      </TableCell>
      <TableCell>
        <span className="text-sm">
          {userTypeConfig[user.user_type as keyof typeof userTypeConfig] || user.user_type}
        </span>
      </TableCell>
      <TableCell>
        <Badge className={statusConfig[user.status as keyof typeof statusConfig]?.color || ''}>
          {statusConfig[user.status as keyof typeof statusConfig]?.label || user.status}
        </Badge>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {format(new Date(user.created_at), 'MMM d, yyyy')}
      </TableCell>
      {isAdmin && (
        <TableCell>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onRoleChange(user)}
                disabled={!canModifyUser(user)}
              >
                <Shield className="h-4 w-4 mr-2" />
                Change Role
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onStatusChange(user)}
                disabled={!canModifyUser(user)}
              >
                <UserCheck className="h-4 w-4 mr-2" />
                Change Status
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onTypeChange(user)}
                disabled={!canModifyUser(user)}
              >
                <GraduationCap className="h-4 w-4 mr-2" />
                Change Type
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(user)}
                disabled={!canDeleteUser(user)}
                className="text-destructive focus:text-destructive disabled:text-muted-foreground"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete User
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      )}
    </TableRow>
  )
})

interface UsersTableProps {
  onUserChange?: () => void;
}

export function UsersTable({ onUserChange }: UsersTableProps = {}) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [totalUsers, setTotalUsers] = useState(0)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [showRoleDialog, setShowRoleDialog] = useState(false)
  const [showStatusDialog, setShowStatusDialog] = useState(false)
  const [showTypeDialog, setShowTypeDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [pendingRole, setPendingRole] = useState<string>('')
  const [pendingStatus, setPendingStatus] = useState<string>('')
  const [pendingType, setPendingType] = useState<string>('')

  const { user: currentUser } = useAuthStatus()
  const { isAdmin } = useUserRole()

  // Helper functions for safety checks
  const canModifyUser = (targetUser: User) => {
    return isAdmin && currentUser?.id !== targetUser.id
  }

  const canDeleteUser = (targetUser: User) => {
    return isAdmin && currentUser?.id !== targetUser.id
  }

  const getDisplayName = useCallback((user: User) => {
    return user.first_name && user.last_name
      ? `${user.first_name} ${user.last_name}`
      : user.email || 'Unknown User'
  }, [])

  const handleRoleDialogOpen = useCallback((user: User) => {
    setSelectedUser(user)
    setPendingRole(user.role)
    setShowRoleDialog(true)
  }, [])

  const handleStatusDialogOpen = useCallback((user: User) => {
    setSelectedUser(user)
    setPendingStatus(user.status)
    setShowStatusDialog(true)
  }, [])

  const handleTypeDialogOpen = useCallback((user: User) => {
    setSelectedUser(user)
    setPendingType(user.user_type)
    setShowTypeDialog(true)
  }, [])

  const handleDeleteDialogOpen = useCallback((user: User) => {
    setSelectedUser(user)
    setShowDeleteDialog(true)
  }, [])

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      // Use the admin API endpoint instead of direct Supabase queries
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: PAGE_SIZE.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(roleFilter !== 'all' && { role: roleFilter }),
        ...(statusFilter !== 'all' && { status: statusFilter })
      })

      const response = await fetch(`/api/admin/users?${params}`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to load users')
      }

      const data = await response.json()

      setUsers(data.users || [])
      setTotalUsers(data.totalUsers || 0)
      setTotalPages(data.totalPages || 0)
    } catch (error) {
      console.error('Error loading users:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [searchTerm, roleFilter, statusFilter, page])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const handleSearch = useCallback((value: string) => {
    setSearchTerm(value)
    setPage(0)
  }, [])

  const handleRoleChange = async (userId: string, newRole: string) => {
    setIsUpdating(true)
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          updates: { role: newRole }
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update user role')
      }

      toast.success('User role updated successfully')

      await loadUsers()
      onUserChange?.()
    } catch (error) {
      console.error('Error updating role:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update user role')
    } finally {
      setIsUpdating(false)
      setShowRoleDialog(false)
      setSelectedUser(null)
    }
  }

  const handleStatusChange = async (userId: string, newStatus: string) => {
    setIsUpdating(true)
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          updates: { status: newStatus }
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update user status')
      }

      toast.success('User status updated successfully')

      await loadUsers()
      onUserChange?.()
    } catch (error) {
      console.error('Error updating status:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update user status')
    } finally {
      setIsUpdating(false)
      setShowStatusDialog(false)
      setSelectedUser(null)
    }
  }

  const handleTypeChange = async (userId: string, newType: string) => {
    setIsUpdating(true)
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          updates: { user_type: newType }
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update user type')
      }

      toast.success('User type updated successfully')

      await loadUsers()
      onUserChange?.()
    } catch (error) {
      console.error('Error updating type:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update user type')
    } finally {
      setIsUpdating(false)
      setShowTypeDialog(false)
      setSelectedUser(null)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!userId) {
      toast.error('Invalid user ID')
      return
    }

    setIsUpdating(true)
    try {
      console.log('Attempting to delete user:', userId)

      const response = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ userId })
      })

      const responseData = await response.json()
      console.log('Delete user response:', { status: response.status, data: responseData })

      if (!response.ok) {
        const errorMessage = responseData.error || `Failed to delete user (${response.status})`
        console.error('Delete user failed:', { status: response.status, error: errorMessage })
        throw new Error(errorMessage)
      }

      toast.success(responseData.message || 'User deleted successfully')
      console.log('User deleted successfully:', userId)

      // Reload the users list
      await loadUsers()
      onUserChange?.()

    } catch (error) {
      console.error('Error deleting user:', error)

      // Provide more specific error messages
      let errorMessage = 'Failed to delete user'
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          errorMessage = 'User not found'
        } else if (error.message.includes('permission') || error.message.includes('Forbidden')) {
          errorMessage = 'You do not have permission to delete this user'
        } else if (error.message.includes('Cannot delete your own account')) {
          errorMessage = 'You cannot delete your own account'
        } else {
          errorMessage = error.message
        }
      }

      toast.error(errorMessage)
    } finally {
      setIsUpdating(false)
      setShowDeleteDialog(false)
      setSelectedUser(null)
    }
  }



  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Select value={roleFilter} onValueChange={(value) => { setRoleFilter(value); setPage(0) }}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="creator">Creator</SelectItem>
              <SelectItem value="reviewer">Reviewer</SelectItem>
              <SelectItem value="user">User</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(0) }}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={loadUsers}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              {isAdmin && <TableHead className="w-[70px]"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 6 : 5} className="h-24 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 6 : 5} className="h-24 text-center text-muted-foreground">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  isAdmin={isAdmin}
                  onRoleChange={handleRoleDialogOpen}
                  onStatusChange={handleStatusDialogOpen}
                  onTypeChange={handleTypeDialogOpen}
                  onDelete={handleDeleteDialogOpen}
                  canModifyUser={canModifyUser}
                  canDeleteUser={canDeleteUser}
                  getDisplayName={getDisplayName}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            Showing {users.length > 0 ? page * PAGE_SIZE + 1 : 0} to{' '}
            {Math.min((page + 1) * PAGE_SIZE, totalUsers)} of {totalUsers} users
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setPage(page - 1)}
              disabled={page === 0}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages - 1}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Role Change Dialog */}
      <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <DialogPortal>
          <DialogOverlay className="backdrop-blur-md bg-black/20" />
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Change User Role</DialogTitle>
              <DialogDescription>
                Select a new role for {selectedUser && getDisplayName(selectedUser)}.
                This will affect their permissions across the platform.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Select
                value={pendingRole}
                onValueChange={setPendingRole}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="creator">Creator</SelectItem>
                  <SelectItem value="reviewer">Reviewer</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRoleDialog(false)} disabled={isUpdating}>
                Cancel
              </Button>
              <Button
                onClick={() => selectedUser && handleRoleChange(selectedUser.id, pendingRole)}
                disabled={isUpdating || !pendingRole || pendingRole === selectedUser?.role || !selectedUser || !canModifyUser(selectedUser)}
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Confirm'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </DialogPortal>
      </Dialog>

      {/* Status Change Dialog */}
      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogPortal>
          <DialogOverlay className="backdrop-blur-md bg-black/20" />
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Change User Status</DialogTitle>
              <DialogDescription>
                Select a new status for {selectedUser && getDisplayName(selectedUser)}.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Select
                value={pendingStatus}
                onValueChange={setPendingStatus}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowStatusDialog(false)} disabled={isUpdating}>
                Cancel
              </Button>
              <Button
                onClick={() => selectedUser && handleStatusChange(selectedUser.id, pendingStatus)}
                disabled={isUpdating || !pendingStatus || pendingStatus === selectedUser?.status || !selectedUser || !canModifyUser(selectedUser)}
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Confirm'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </DialogPortal>
      </Dialog>

      {/* Type Change Dialog */}
      <Dialog open={showTypeDialog} onOpenChange={setShowTypeDialog}>
        <DialogPortal>
          <DialogOverlay className="backdrop-blur-md bg-black/20" />
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Change User Type</DialogTitle>
              <DialogDescription>
                Select a new type for {selectedUser && getDisplayName(selectedUser)}.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Select
                value={pendingType}
                onValueChange={setPendingType}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="resident">Resident</SelectItem>
                  <SelectItem value="fellow">Fellow</SelectItem>
                  <SelectItem value="attending">Attending</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowTypeDialog(false)} disabled={isUpdating}>
                Cancel
              </Button>
              <Button
                onClick={() => selectedUser && handleTypeChange(selectedUser.id, pendingType)}
                disabled={isUpdating || !pendingType || pendingType === selectedUser?.user_type || !selectedUser || !canModifyUser(selectedUser)}
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Confirm'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </DialogPortal>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogPortal>
          <DialogOverlay className="backdrop-blur-md bg-black/20" />
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Confirm Deletion</DialogTitle>
              <DialogDescription>
                {selectedUser && currentUser?.id === selectedUser.id ? (
                  <>
                    You cannot delete your own account.
                    <br />
                    Please contact another administrator to delete your account.
                  </>
                ) : (
                  <>
                    Are you sure you want to permanently delete {selectedUser && getDisplayName(selectedUser)}?
                    <br />
                    This action cannot be undone.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={isUpdating}>
                Cancel
              </Button>
              <Button
                onClick={() => selectedUser && handleDeleteUser(selectedUser.id)}
                disabled={isUpdating || !selectedUser || !canDeleteUser(selectedUser)}
                variant="destructive"
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete User'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </div>
  )
}