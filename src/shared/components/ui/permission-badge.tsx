import { Badge } from "@/shared/components/ui/badge";
import { cn } from "@/shared/utils";
import { PERMISSION_LABELS, isPermission } from "@/shared/utils/auth/permissions";

const PERMISSION_COLORS: Record<string, string> = {
  create_questions: "border-yellow-300 bg-yellow-50 text-yellow-700",
  review_questions: "border-purple-300 bg-purple-50 text-purple-700",
};

interface PermissionBadgeProps {
  permission: string;
  className?: string;
}

/** A granted permission (see shared/utils/auth/permissions.ts), canonical outline style. */
export function PermissionBadge({ permission, className }: PermissionBadgeProps) {
  const label = isPermission(permission) ? PERMISSION_LABELS[permission].label : permission;
  const color = PERMISSION_COLORS[permission] ?? "border-gray-300 bg-gray-50 text-gray-700";
  return (
    <Badge variant="outline" className={cn(color, className)}>
      {label}
    </Badge>
  );
}
