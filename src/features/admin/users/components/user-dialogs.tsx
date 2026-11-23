"use client";

import { type ReactNode } from "react";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Label } from "@/shared/components/ui/label";
import { Loader2 } from "lucide-react";
import { PERMISSIONS, PERMISSION_LABELS, type Permission } from "@/shared/utils/auth/permissions";
import { type User, getUserDisplayName } from "./users-table-utils";

interface FieldOption {
  value: string;
  label: string;
}

export const ROLE_OPTIONS: FieldOption[] = [
  { value: "admin", label: "Admin" },
  { value: "user", label: "User" },
];

export const STATUS_OPTIONS: FieldOption[] = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "suspended", label: "Suspended" },
];

export const TYPE_OPTIONS: FieldOption[] = [
  { value: "student", label: "Student" },
  { value: "resident", label: "Resident" },
  { value: "fellow", label: "Fellow" },
  { value: "attending", label: "Attending" },
  { value: "faculty", label: "Faculty" },
  { value: "other", label: "Other" },
];

interface UserFieldChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  value: string;
  onValueChange: (value: string) => void;
  options: FieldOption[];
  /** Disable the confirm button independent of the updating spinner (e.g. unchanged value). */
  confirmDisabled: boolean;
  isUpdating: boolean;
  onConfirm: () => void;
}

/** Shared "pick a value → confirm" dialog used for role, status, and type changes. */
export function UserFieldChangeDialog({
  open,
  onOpenChange,
  title,
  description,
  value,
  onValueChange,
  options,
  confirmDisabled,
  isUpdating,
  onConfirm,
}: UserFieldChangeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="backdrop-blur-md bg-black/20" />
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={value} onValueChange={onValueChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUpdating}>
              Cancel
            </Button>
            <Button onClick={onConfirm} disabled={isUpdating || confirmDisabled}>
              {isUpdating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                "Confirm"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

interface UserPermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  value: Permission[];
  onValueChange: (value: Permission[]) => void;
  confirmDisabled: boolean;
  isUpdating: boolean;
  onConfirm: () => void;
}

/** Grant or revoke permissions. Admins hold every permission, so their boxes are locked. */
export function UserPermissionsDialog({
  open,
  onOpenChange,
  user,
  value,
  onValueChange,
  confirmDisabled,
  isUpdating,
  onConfirm,
}: UserPermissionsDialogProps) {
  const isAdminTarget = user?.role === "admin";
  const toggle = (permission: Permission, checked: boolean) =>
    onValueChange(
      checked
        ? PERMISSIONS.filter((p) => p === permission || value.includes(p))
        : value.filter((p) => p !== permission)
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="backdrop-blur-md bg-black/20" />
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Permissions</DialogTitle>
            <DialogDescription>
              {isAdminTarget ? (
                <>{user && getUserDisplayName(user)} is an admin and holds every permission.</>
              ) : (
                <>
                  Choose what {user && getUserDisplayName(user)} can do. Changes apply on their next
                  request.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {PERMISSIONS.map((permission) => {
              const id = `permission-${permission}`;
              return (
                <div key={permission} className="flex items-start gap-3">
                  <Checkbox
                    id={id}
                    checked={isAdminTarget || value.includes(permission)}
                    disabled={isAdminTarget || isUpdating}
                    onCheckedChange={(checked) => toggle(permission, checked === true)}
                    className="mt-0.5"
                  />
                  <div className="space-y-1">
                    <Label htmlFor={id} className="font-medium">
                      {PERMISSION_LABELS[permission].label}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {PERMISSION_LABELS[permission].description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUpdating}>
              Cancel
            </Button>
            <Button onClick={onConfirm} disabled={isUpdating || confirmDisabled || isAdminTarget}>
              {isUpdating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

interface DeleteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  isSelf: boolean;
  confirmDisabled: boolean;
  isUpdating: boolean;
  onConfirm: () => void;
}

export function DeleteUserDialog({
  open,
  onOpenChange,
  user,
  isSelf,
  confirmDisabled,
  isUpdating,
  onConfirm,
}: DeleteUserDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="backdrop-blur-md bg-black/20" />
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              {isSelf ? (
                <>
                  You cannot delete your own account.
                  <br />
                  Please contact another administrator to delete your account.
                </>
              ) : (
                <>
                  Are you sure you want to permanently delete {user && getUserDisplayName(user)}?
                  <br />
                  This action cannot be undone.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUpdating}>
              Cancel
            </Button>
            <Button
              onClick={onConfirm}
              disabled={isUpdating || confirmDisabled}
              variant="destructive"
            >
              {isUpdating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete User"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
