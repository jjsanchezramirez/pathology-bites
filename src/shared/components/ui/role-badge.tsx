import { Badge } from "@/shared/components/ui/badge";
import { cn } from "@/shared/utils";

const ROLE_CONFIG: Record<string, { label: string; color: string }> = {
  admin: { label: "Admin", color: "border-blue-300 bg-blue-50 text-blue-700" },
  creator: { label: "Creator", color: "border-yellow-300 bg-yellow-50 text-yellow-700" },
  reviewer: { label: "Reviewer", color: "border-purple-300 bg-purple-50 text-purple-700" },
  user: { label: "User", color: "border-gray-300 bg-gray-50 text-gray-700" },
};

interface RoleBadgeProps {
  role: string;
  className?: string;
}

export function RoleBadge({ role, className }: RoleBadgeProps) {
  const cfg = ROLE_CONFIG[role] ?? {
    label: role,
    color: "border-gray-300 bg-gray-50 text-gray-700",
  };
  return (
    <Badge variant="outline" className={cn(cfg.color, className)}>
      {cfg.label}
    </Badge>
  );
}
