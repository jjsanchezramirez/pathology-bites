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
import { format, formatDistanceToNowStrict } from "date-fns";
import { type User, userTypeConfig, getUserDisplayName } from "./users-table-utils";

function ago(iso: string | null): string | null {
  return iso ? `${formatDistanceToNowStrict(new Date(iso))} ago` : null;
}

interface UserRowProps {
  user: User;
  isAdmin: boolean;
  onRoleChange: (user: User) => void;
  onStatusChange: (user: User) => void;
  onTypeChange: (user: User) => void;
  onDelete: (user: User) => void;
  onSelect: (user: User) => void;
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
  onSelect,
  canModifyUser,
  canDeleteUser,
}: UserRowProps) {
  const lastQuiz = ago(user.last_quiz_at);
  return (
    <TableRow key={user.id} onClick={() => onSelect(user)} className="cursor-pointer">
      <TableCell>
        <div className="min-w-0">
          {/* The row is clickable for mouse users; this button is the keyboard path. */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(user);
            }}
            className="block max-w-full truncate text-left font-medium hover:underline focus-visible:underline focus-visible:outline-none"
          >
            {getUserDisplayName(user)}
          </button>
          <div className="truncate text-xs text-muted-foreground">{user.email}</div>
          {user.institution && (
            <div className="truncate text-xs text-muted-foreground">{user.institution}</div>
          )}
        </div>
      </TableCell>
      <TableCell>
        <RoleBadge role={user.role} className="text-[10px] px-1.5 py-0" />
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <span className="text-sm">
          {userTypeConfig[user.user_type as keyof typeof userTypeConfig] || user.user_type}
        </span>
      </TableCell>
      <TableCell>
        <UserStatusBadge status={user.status} className="text-[10px] px-1.5 py-0" />
      </TableCell>
      <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
        {format(new Date(user.created_at), "MMM d, yyyy")}
      </TableCell>
      <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
        {ago(user.last_sign_in_at) ?? "Never"}
      </TableCell>
      <TableCell className="hidden lg:table-cell">
        <div className="text-sm tabular-nums">{user.quizzes_completed}</div>
        {lastQuiz && <div className="text-xs text-muted-foreground">last {lastQuiz}</div>}
      </TableCell>
      {isAdmin && (
        <TableCell onClick={(e) => e.stopPropagation()}>
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
