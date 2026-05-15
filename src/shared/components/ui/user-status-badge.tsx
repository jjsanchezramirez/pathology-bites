import { Badge } from "@/shared/components/ui/badge";
import { cn } from "@/shared/utils";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: { label: "Active", color: "border-green-300 bg-green-50 text-green-700" },
  inactive: { label: "Inactive", color: "border-gray-300 bg-gray-50 text-gray-700" },
  suspended: { label: "Suspended", color: "border-red-300 bg-red-50 text-red-700" },
};

interface UserStatusBadgeProps {
  status: string;
  className?: string;
}

export function UserStatusBadge({ status, className }: UserStatusBadgeProps) {
  const cfg = STATUS_CONFIG[status] ?? {
    label: status,
    color: "border-gray-300 bg-gray-50 text-gray-700",
  };
  return (
    <Badge variant="outline" className={cn(cfg.color, className)}>
      {cfg.label}
    </Badge>
  );
}
