import { Badge } from "@/shared/components/ui/badge";
import { DIFFICULTY_CONFIG, type QuestionDifficulty } from "@/shared/types/questions";
import { cn } from "@/shared/utils";

interface DifficultyBadgeProps {
  difficulty: QuestionDifficulty | string | null | undefined;
  short?: boolean;
  className?: string;
}

export function DifficultyBadge({ difficulty, short, className }: DifficultyBadgeProps) {
  if (!difficulty) return null;
  const key = String(difficulty).toLowerCase() as QuestionDifficulty;
  const config = DIFFICULTY_CONFIG[key];
  if (!config) return null;
  return (
    <Badge variant="outline" className={cn("text-xs border", config.color, className)}>
      {short ? config.short : config.label}
    </Badge>
  );
}
