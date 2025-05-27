// src/components/users/users-table.tsx
'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/hooks/use-toast'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Search,
  Loader2,
  MoreVertical,
  Shield,
  UserCheck,
  RefreshCw
} from 'lucide-react'
import { format } from 'date-fns'

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
  admin: { label: 'Admin', color: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' },
  user: { label: 'User', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' },
}

const statusConfig = {
  active: { label: 'Active', color: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' },
  inactive: { label: 'Inactive', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-300' },
  suspended: { label: 'Suspended', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300' },
}

const userTypeConfig = {
  student: 'Student',
  resident: 'Resident',
  fellow: 'Fellow',
  attending: 'Attending',
  other: 'Other',
}

export function UsersTable() {
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
  const [isUpdating, setIsUpdating] = useState(false)

  const supabase = createClient()
  const { toast } = useToast()

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
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load users',
      })
    } finally {
      setLoading(false)
    }
  }, [searchTerm, roleFilter, statusFilter, page, toast])

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

      toast({
        title: 'Success',
        description: 'User role updated successfully',
      })

      await loadUsers()
    } catch (error) {
      console.error('Error updating role:', error)
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update user role',
      })
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

      toast({
        title: 'Success',
        description: 'User status updated successfully',
      })

      await loadUsers()
    } catch (error) {
      console.error('Error updating status:', error)
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update user status',
      })
    } finally {
      setIsUpdating(false)
      setShowStatusDialog(false)
      setSelectedUser(null)
    }
  }

  const getDisplayName = (user: User) => {
    if (user.first_name || user.last_name) {
      return `${user.first_name || ''} ${user.last_name || ''}`.trim()
    }
    return user.email?.split('@')[0] || 'Unknown'
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
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{getDisplayName(user)}</div>
                      <div className="text-sm text-muted-foreground">{user.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={roleConfig[user.role as keyof typeof roleConfig]?.color || ''}>
                      {roleConfig[user.role as keyof typeof roleConfig]?.label || user.role}
                    </Badge>
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
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedUser(user)
                            setShowRoleDialog(true)
                          }}
                        >
                          <Shield className="h-4 w-4 mr-2" />
                          Change Role
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedUser(user)
                            setShowStatusDialog(true)
                          }}
                        >
                          <UserCheck className="h-4 w-4 mr-2" />
                          Change Status
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
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
      <AlertDialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change User Role</AlertDialogTitle>
            <AlertDialogDescription>
              Select a new role for {selectedUser && getDisplayName(selectedUser)}.
              This will affect their permissions across the platform.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Select
              defaultValue={selectedUser?.role}
              onValueChange={(value) => selectedUser && handleRoleChange(selectedUser.id, value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="user">User</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdating}>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Status Change Dialog */}
      <AlertDialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change User Status</AlertDialogTitle>
            <AlertDialogDescription>
              Select a new status for {selectedUser && getDisplayName(selectedUser)}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Select
              defaultValue={selectedUser?.status}
              onValueChange={(value) => selectedUser && handleStatusChange(selectedUser.id, value)}
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
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdating}>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}