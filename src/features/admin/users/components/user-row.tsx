"use client";

import { memo } from "react";
import { TableCell, TableRow } from "@/shared/components/ui/table";
import { Button } from "@/shared/components/ui/button";
import { RoleBadge } from "@/shared/components/ui/role-badge";
import { UserStatusBadge } from "@/shared/components/ui/user-status-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { MoreVertical, Shield, UserCheck, GraduationCap, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { type User, userTypeConfig, getUserDisplayName } from "./users-table-utils";

interface UserRowProps {
  user: User;
  isAdmin: boolean;
  onRoleChange: (user: User) => void;
  onStatusChange: (user: User) => void;
  onTypeChange: (user: User) => void;
  onDelete: (user: User) => void;
  canModifyUser: (user: User) => boolean;
  canDeleteUser: (user: User) => boolean;
}

export const UserRow = memo(function UserRow({
  user,
  isAdmin,
  onRoleChange,
  onStatusChange,
  onTypeChange,
  onDelete,
  canModifyUser,
  canDeleteUser,
}: UserRowProps) {
  return (
    <TableRow key={user.id}>
      <TableCell>
        <div>
          <div className="font-medium">{getUserDisplayName(user)}</div>
          <div className="text-sm text-muted-foreground">{user.email}</div>
        </div>
      </TableCell>
      <TableCell>
        <RoleBadge role={user.role} className="text-[10px] px-1.5 py-0" />
      </TableCell>
      <TableCell>
        <span className="text-sm">
          {userTypeConfig[user.user_type as keyof typeof userTypeConfig] || user.user_type}
        </span>
      </TableCell>
      <TableCell>
        <UserStatusBadge status={user.status} className="text-[10px] px-1.5 py-0" />
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {format(new Date(user.created_at), "MMM d, yyyy")}
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
              <DropdownMenuItem onClick={() => onRoleChange(user)} disabled={!canModifyUser(user)}>
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
              <DropdownMenuItem onClick={() => onTypeChange(user)} disabled={!canModifyUser(user)}>
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
  );
});
