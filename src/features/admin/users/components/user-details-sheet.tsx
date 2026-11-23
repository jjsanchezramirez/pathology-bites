"use client";

import type { ReactNode } from "react";
import { format, formatDistanceToNowStrict } from "date-fns";
import { GraduationCap, KeyRound, Shield, Trash2, UserCheck } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/sheet";
import { Button } from "@/shared/components/ui/button";
import { Separator } from "@/shared/components/ui/separator";
import { RoleBadge } from "@/shared/components/ui/role-badge";
import { PermissionBadge } from "@/shared/components/ui/permission-badge";
import { UserStatusBadge } from "@/shared/components/ui/user-status-badge";
import { type User, userTypeConfig, getUserDisplayName } from "./users-table-utils";

interface UserDetailsSheetProps {
  user: User | null;
  onOpenChange: (open: boolean) => void;
  canModify: boolean;
  canDelete: boolean;
  onRoleChange: (user: User) => void;
  onPermissionsChange: (user: User) => void;
  onStatusChange: (user: User) => void;
  onTypeChange: (user: User) => void;
  onDelete: (user: User) => void;
}

function when(iso: string | null): ReactNode {
  if (!iso) return <span className="text-muted-foreground">Never</span>;
  const d = new Date(iso);
  return (
    <>
      {format(d, "MMM d, yyyy")}{" "}
      <span className="text-muted-foreground">({formatDistanceToNowStrict(d)} ago)</span>
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-3 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

export function UserDetailsSheet({
  user,
  onOpenChange,
  canModify,
  canDelete,
  onRoleChange,
  onPermissionsChange,
  onStatusChange,
  onTypeChange,
  onDelete,
}: UserDetailsSheetProps) {
  return (
    <Sheet open={!!user} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {user && (
          <>
            <SheetHeader className="p-4 pr-10">
              <SheetTitle>{getUserDisplayName(user)}</SheetTitle>
              <SheetDescription>{user.email}</SheetDescription>
            </SheetHeader>

            <div className="space-y-6 px-4 pb-6">
              <dl>
                <Field label="Name">
                  {user.first_name || user.last_name ? (
                    `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim()
                  ) : (
                    <span className="text-muted-foreground">Not set</span>
                  )}
                </Field>
                <Field label="Email">
                  {user.email}{" "}
                  {user.email_confirmed_at ? (
                    <span className="text-xs text-green-700">(confirmed)</span>
                  ) : (
                    <span className="text-xs text-amber-700">(unconfirmed)</span>
                  )}
                </Field>
                <Field label="Institution">
                  {user.institution || <span className="text-muted-foreground">Not set</span>}
                </Field>
                <Field label="Type">
                  {userTypeConfig[user.user_type as keyof typeof userTypeConfig] || user.user_type}
                </Field>
                <Field label="Role">
                  <RoleBadge role={user.role} />
                </Field>
                <Field label="Permissions">
                  {user.role === "admin" ? (
                    <span className="text-muted-foreground">All (admin)</span>
                  ) : (user.permissions ?? []).length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {user.permissions.map((p) => (
                        <PermissionBadge key={p} permission={p} />
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">None</span>
                  )}
                </Field>
                <Field label="Status">
                  <UserStatusBadge status={user.status} />
                </Field>
              </dl>

              <Separator />

              <dl>
                <Field label="Joined">{when(user.created_at)}</Field>
                <Field label="Last sign-in">{when(user.last_sign_in_at)}</Field>
                <Field label="Quizzes">
                  {user.quizzes_completed} completed
                  {user.quizzes_started > user.quizzes_completed && (
                    <span className="text-muted-foreground">
                      {" "}
                      · {user.quizzes_started - user.quizzes_completed} unfinished
                    </span>
                  )}
                </Field>
                <Field label="Last quiz">{when(user.last_quiz_at)}</Field>
              </dl>

              {(canModify || canDelete) && (
                <>
                  <Separator />
                  <div className="flex flex-wrap gap-2">
                    {canModify && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => onRoleChange(user)}>
                          <Shield className="mr-2 h-4 w-4" />
                          Change role
                        </Button>
                        {user.role !== "admin" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onPermissionsChange(user)}
                          >
                            <KeyRound className="mr-2 h-4 w-4" />
                            Manage permissions
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => onStatusChange(user)}>
                          <UserCheck className="mr-2 h-4 w-4" />
                          Change status
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => onTypeChange(user)}>
                          <GraduationCap className="mr-2 h-4 w-4" />
                          Change type
                        </Button>
                      </>
                    )}
                    {canDelete && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => onDelete(user)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete user
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
