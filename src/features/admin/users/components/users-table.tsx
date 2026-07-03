// src/features/users/components/users-table.tsx
"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import useSWR from "swr";
import { fetcher } from "@/shared/utils/api/fetcher";
import { toast } from "@/shared/utils/ui/toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Search, Loader2, RefreshCw } from "lucide-react";
import { useUserRole } from "@/shared/hooks/use-user-role";
import { useAuthContext } from "@/features/auth/components/auth-provider";
import { apiClient } from "@/shared/utils/api/api-client";
import { log } from "@/shared/utils/logging";
import { type User, PAGE_SIZE, getUserDisplayName } from "./users-table-utils";
import { UserRow } from "./user-row";
import { UsersPagination } from "./users-pagination";
import {
  UserFieldChangeDialog,
  DeleteUserDialog,
  ROLE_OPTIONS,
  STATUS_OPTIONS,
  TYPE_OPTIONS,
} from "./user-dialogs";

interface UsersTableProps {
  onUserChange?: () => void;
}

export function UsersTable({ onUserChange }: UsersTableProps = {}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [showTypeDialog, setShowTypeDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [pendingRole, setPendingRole] = useState<string>("");
  const [pendingStatus, setPendingStatus] = useState<string>("");
  const [pendingType, setPendingType] = useState<string>("");

  const { user: currentUser } = useAuthContext();
  const { isAdmin } = useUserRole();

  // Debug: Track component lifecycle
  useEffect(() => {
    log.debug(`[UsersTable] 🟢 Mounted`);
    return () => {
      log.debug(`[UsersTable] 🔴 Unmounted`);
    };
  }, []);

  // Build API URL with query params
  const apiUrl = useMemo(() => {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: PAGE_SIZE.toString(),
      ...(searchTerm && { search: searchTerm }),
      ...(roleFilter !== "all" && { role: roleFilter }),
      ...(statusFilter !== "all" && { status: statusFilter }),
    });
    const url = `/api/admin/users?${params.toString()}`;
    log.debug("[UsersTable] API URL:", url);
    return url;
  }, [page, searchTerm, roleFilter, statusFilter]);

  // Use SWR for data fetching with caching and deduplication
  const { data, isLoading, mutate } = useSWR(
    apiUrl,
    (url: string) => fetcher<{ users: User[]; totalUsers: number; totalPages: number }>(url),
    {
      revalidateOnFocus: false,
      dedupingInterval: 2000, // Prevent duplicate requests within 2 seconds
      revalidateOnReconnect: false,
      onError: (err) => {
        log.error("[UsersTable] ❌ Error loading users:", err);
        toast.error(err instanceof Error ? err.message : "Failed to load users");
      },
    }
  );

  const users = data?.users || [];
  const totalUsers = data?.totalUsers || 0;
  const totalPages = data?.totalPages || 0;

  // Helper functions for safety checks
  const canModifyUser = (targetUser: User) => {
    return isAdmin && currentUser?.id !== targetUser.id;
  };

  const canDeleteUser = (targetUser: User) => {
    return isAdmin && currentUser?.id !== targetUser.id;
  };

  const handleRoleDialogOpen = useCallback((user: User) => {
    setSelectedUser(user);
    setPendingRole(user.role);
    setShowRoleDialog(true);
  }, []);

  const handleStatusDialogOpen = useCallback((user: User) => {
    setSelectedUser(user);
    setPendingStatus(user.status);
    setShowStatusDialog(true);
  }, []);

  const handleTypeDialogOpen = useCallback((user: User) => {
    setSelectedUser(user);
    setPendingType(user.user_type);
    setShowTypeDialog(true);
  }, []);

  const handleDeleteDialogOpen = useCallback((user: User) => {
    setSelectedUser(user);
    setShowDeleteDialog(true);
  }, []);

  const handleSearch = useCallback((value: string) => {
    setSearchTerm(value);
    setPage(0);
  }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    setIsUpdating(true);
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          updates: { role: newRole },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update user role");
      }

      toast.success("User role updated successfully");

      // Revalidate SWR cache
      await mutate();
      onUserChange?.();
    } catch (error) {
      log.error("Error updating role:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update user role");
    } finally {
      setIsUpdating(false);
      setShowRoleDialog(false);
      setSelectedUser(null);
    }
  };

  const handleStatusChange = async (userId: string, newStatus: string) => {
    setIsUpdating(true);
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          updates: { status: newStatus },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update user status");
      }

      toast.success("User status updated successfully");

      // Revalidate SWR cache
      await mutate();
      onUserChange?.();
    } catch (error) {
      log.error("Error updating status:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update user status");
    } finally {
      setIsUpdating(false);
      setShowStatusDialog(false);
      setSelectedUser(null);
    }
  };

  const handleTypeChange = async (userId: string, newType: string) => {
    setIsUpdating(true);
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          updates: { user_type: newType },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update user type");
      }

      toast.success("User type updated successfully");

      // Revalidate SWR cache
      await mutate();
      onUserChange?.();
    } catch (error) {
      log.error("Error updating type:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update user type");
    } finally {
      setIsUpdating(false);
      setShowTypeDialog(false);
      setSelectedUser(null);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!userId) {
      toast.error("Invalid user ID");
      return;
    }

    setIsUpdating(true);
    try {
      log.debug("Attempting to delete user:", userId);

      const response = await apiClient.delete("/api/admin/users", { userId });

      const responseData = await response.json();
      log.debug("Delete user response:", { status: response.status, data: responseData });

      if (!response.ok) {
        const errorMessage = responseData.error || `Failed to delete user (${response.status})`;
        log.error("Delete user failed:", { status: response.status, error: errorMessage });
        throw new Error(errorMessage);
      }

      toast.success(responseData.message || "User deleted successfully");
      log.debug("User deleted successfully:", userId);

      // Revalidate SWR cache
      await mutate();
      onUserChange?.();
    } catch (error) {
      log.error("Error deleting user:", error);

      // Provide more specific error messages
      let errorMessage = "Failed to delete user";
      if (error instanceof Error) {
        if (error.message.includes("not found")) {
          errorMessage = "User not found";
        } else if (error.message.includes("permission") || error.message.includes("Forbidden")) {
          errorMessage = "You do not have permission to delete this user";
        } else if (error.message.includes("Cannot delete your own account")) {
          errorMessage = "You cannot delete your own account";
        } else {
          errorMessage = error.message;
        }
      }

      toast.error(errorMessage);
    } finally {
      setIsUpdating(false);
      setShowDeleteDialog(false);
      setSelectedUser(null);
    }
  };

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
          <Select
            value={roleFilter}
            onValueChange={(value) => {
              setRoleFilter(value);
              setPage(0);
            }}
          >
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
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value);
              setPage(0);
            }}
          >
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
          <Button variant="outline" size="icon" onClick={() => mutate()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
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
              {isAdmin && <TableHead className="w-[70px] text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 6 : 5} className="h-24 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={isAdmin ? 6 : 5}
                  className="h-24 text-center text-muted-foreground"
                >
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              users.map((user: User) => (
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
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <UsersPagination
        page={page}
        totalPages={totalPages}
        totalUsers={totalUsers}
        shownCount={users.length}
        onPageChange={setPage}
      />

      {/* Role Change Dialog */}
      <UserFieldChangeDialog
        open={showRoleDialog}
        onOpenChange={setShowRoleDialog}
        title="Change User Role"
        description={
          <>
            Select a new role for {selectedUser && getUserDisplayName(selectedUser)}. This will
            affect their permissions across the platform.
          </>
        }
        value={pendingRole}
        onValueChange={setPendingRole}
        options={ROLE_OPTIONS}
        confirmDisabled={
          !pendingRole ||
          pendingRole === selectedUser?.role ||
          !selectedUser ||
          !canModifyUser(selectedUser)
        }
        isUpdating={isUpdating}
        onConfirm={() => selectedUser && handleRoleChange(selectedUser.id, pendingRole)}
      />

      {/* Status Change Dialog */}
      <UserFieldChangeDialog
        open={showStatusDialog}
        onOpenChange={setShowStatusDialog}
        title="Change User Status"
        description={
          <>Select a new status for {selectedUser && getUserDisplayName(selectedUser)}.</>
        }
        value={pendingStatus}
        onValueChange={setPendingStatus}
        options={STATUS_OPTIONS}
        confirmDisabled={
          !pendingStatus ||
          pendingStatus === selectedUser?.status ||
          !selectedUser ||
          !canModifyUser(selectedUser)
        }
        isUpdating={isUpdating}
        onConfirm={() => selectedUser && handleStatusChange(selectedUser.id, pendingStatus)}
      />

      {/* Type Change Dialog */}
      <UserFieldChangeDialog
        open={showTypeDialog}
        onOpenChange={setShowTypeDialog}
        title="Change User Type"
        description={<>Select a new type for {selectedUser && getUserDisplayName(selectedUser)}.</>}
        value={pendingType}
        onValueChange={setPendingType}
        options={TYPE_OPTIONS}
        confirmDisabled={
          !pendingType ||
          pendingType === selectedUser?.user_type ||
          !selectedUser ||
          !canModifyUser(selectedUser)
        }
        isUpdating={isUpdating}
        onConfirm={() => selectedUser && handleTypeChange(selectedUser.id, pendingType)}
      />

      {/* Delete User Dialog */}
      <DeleteUserDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        user={selectedUser}
        isSelf={!!selectedUser && currentUser?.id === selectedUser.id}
        confirmDisabled={!selectedUser || !canDeleteUser(selectedUser)}
        isUpdating={isUpdating}
        onConfirm={() => selectedUser && handleDeleteUser(selectedUser.id)}
      />
    </div>
  );
}
