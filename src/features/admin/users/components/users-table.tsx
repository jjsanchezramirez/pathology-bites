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
import { Search, Loader2, RefreshCw, ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { TableShell, Toolbar } from "@/shared/components/ui/page-layout";
import { useUserRole } from "@/shared/hooks/use-user-role";
import { useAuthContext } from "@/features/auth/components/auth-provider";
import { apiClient } from "@/shared/utils/api/api-client";
import { log } from "@/shared/utils/logging";
import { parsePermissions, type Permission } from "@/shared/utils/auth/permissions";
import {
  type User,
  type UserSortKey,
  type SortDir,
  PAGE_SIZE,
  DEFAULT_SORT,
  nextSort,
  getUserDisplayName,
} from "./users-table-utils";
import { UserRow } from "./user-row";
import { UserDetailsSheet } from "./user-details-sheet";
import { UsersPagination } from "./users-pagination";
import {
  UserFieldChangeDialog,
  UserPermissionsDialog,
  DeleteUserDialog,
  ROLE_OPTIONS,
  STATUS_OPTIONS,
  TYPE_OPTIONS,
} from "./user-dialogs";

interface UsersTableProps {
  onUserChange?: () => void;
}

function SortableHead({
  label,
  sortKey,
  sort,
  onSort,
  className,
}: {
  label: string;
  sortKey: UserSortKey;
  sort: { key: UserSortKey; dir: SortDir };
  onSort: (key: UserSortKey) => void;
  className?: string;
}) {
  const active = sort.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead
      className={className}
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`-ml-1 inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-foreground ${active ? "text-foreground" : ""}`}
      >
        {label}
        <Icon className={`h-3.5 w-3.5 ${active ? "" : "opacity-40"}`} aria-hidden="true" />
      </button>
    </TableHead>
  );
}

export function UsersTable({ onUserChange }: UsersTableProps = {}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sort, setSort] = useState(DEFAULT_SORT);
  const [page, setPage] = useState(0);
  const [detailUserId, setDetailUserId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [showPermissionsDialog, setShowPermissionsDialog] = useState(false);
  const [pendingPermissions, setPendingPermissions] = useState<Permission[]>([]);
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
      ...(typeFilter !== "all" && { type: typeFilter }),
      sort: sort.key,
      dir: sort.dir,
    });
    const url = `/api/admin/users?${params.toString()}`;
    log.debug("[UsersTable] API URL:", url);
    return url;
  }, [page, searchTerm, roleFilter, statusFilter, typeFilter, sort]);

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
  // Looked up from the live page so the drawer reflects edits after revalidation
  // (and closes on its own if the user is deleted).
  const detailUser = detailUserId ? (users.find((u) => u.id === detailUserId) ?? null) : null;

  const handleSort = useCallback((key: UserSortKey) => {
    setSort((current) => nextSort(current, key));
    setPage(0);
  }, []);

  const handleSelect = useCallback((user: User) => setDetailUserId(user.id), []);

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

  const handlePermissionsDialogOpen = useCallback((user: User) => {
    setSelectedUser(user);
    setPendingPermissions(parsePermissions(user.permissions));
    setShowPermissionsDialog(true);
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

  const handlePermissionsChange = async (userId: string, permissions: Permission[]) => {
    setIsUpdating(true);
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, updates: { permissions } }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update permissions");
      }

      toast.success("Permissions updated");
      await mutate();
      onUserChange?.();
    } catch (error) {
      log.error("Error updating permissions:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update permissions");
    } finally {
      setIsUpdating(false);
      setShowPermissionsDialog(false);
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
      <Toolbar>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, email or institution..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
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
          <Select
            value={typeFilter}
            onValueChange={(value) => {
              setTypeFilter(value);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-[130px]" aria-label="Filter by type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => mutate()}
            disabled={isLoading}
            aria-label="Refresh users"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </Toolbar>

      {/* Table */}
      <TableShell
        footer={
          <UsersPagination
            page={page}
            totalPages={totalPages}
            totalUsers={totalUsers}
            shownCount={users.length}
            onPageChange={setPage}
          />
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead label="User" sortKey="name" sort={sort} onSort={handleSort} />
              <TableHead>Role</TableHead>
              <TableHead className="hidden md:table-cell">Type</TableHead>
              <TableHead>Status</TableHead>
              <SortableHead
                label="Joined"
                sortKey="created_at"
                sort={sort}
                onSort={handleSort}
                className="hidden md:table-cell"
              />
              <SortableHead
                label="Last sign-in"
                sortKey="last_sign_in_at"
                sort={sort}
                onSort={handleSort}
                className="hidden lg:table-cell"
              />
              <SortableHead
                label="Quizzes"
                sortKey="quizzes_completed"
                sort={sort}
                onSort={handleSort}
                className="hidden lg:table-cell"
              />
              {isAdmin && <TableHead className="w-[70px] text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 8 : 7} className="h-24 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={isAdmin ? 8 : 7}
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
                  onPermissionsChange={handlePermissionsDialogOpen}
                  onStatusChange={handleStatusDialogOpen}
                  onTypeChange={handleTypeDialogOpen}
                  onDelete={handleDeleteDialogOpen}
                  onSelect={handleSelect}
                  canModifyUser={canModifyUser}
                  canDeleteUser={canDeleteUser}
                />
              ))
            )}
          </TableBody>
        </Table>
      </TableShell>

      <UserDetailsSheet
        user={detailUser}
        onOpenChange={(open) => !open && setDetailUserId(null)}
        canModify={!!detailUser && canModifyUser(detailUser)}
        canDelete={!!detailUser && canDeleteUser(detailUser)}
        onRoleChange={handleRoleDialogOpen}
        onPermissionsChange={handlePermissionsDialogOpen}
        onStatusChange={handleStatusDialogOpen}
        onTypeChange={handleTypeDialogOpen}
        onDelete={handleDeleteDialogOpen}
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

      {/* Permissions Dialog */}
      <UserPermissionsDialog
        open={showPermissionsDialog}
        onOpenChange={setShowPermissionsDialog}
        user={selectedUser}
        value={pendingPermissions}
        onValueChange={setPendingPermissions}
        confirmDisabled={
          !selectedUser ||
          !canModifyUser(selectedUser) ||
          parsePermissions(selectedUser.permissions).join() === pendingPermissions.join()
        }
        isUpdating={isUpdating}
        onConfirm={() =>
          selectedUser && handlePermissionsChange(selectedUser.id, pendingPermissions)
        }
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
