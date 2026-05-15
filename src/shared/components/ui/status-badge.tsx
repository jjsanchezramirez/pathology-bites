import { Badge } from "@/shared/components/ui/badge";
import { STATUS_CONFIG, type QuestionStatus } from "@/shared/types/questions";
import { cn } from "@/shared/utils";

interface StatusBadgeProps {
  status: QuestionStatus | string | null | undefined;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  if (!status) return null;
  const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
  if (!config) {
    return (
      <Badge
        variant="outline"
        className={cn("border-gray-300 bg-gray-50 text-gray-700 text-xs", className)}
      >
        {String(status)}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className={cn(config.color, "text-xs", className)}>
      {config.label}
    </Badge>
  );
}
