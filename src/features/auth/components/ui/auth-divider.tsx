// src/components/auth/auth-divider.tsx
import { cn } from "@/shared/utils"

interface AuthDividerProps {
  text?: string;
  className?: string;
}

export function AuthDivider({
  text = "Or continue with",
  className,
}: AuthDividerProps) {
  return (
    <div className={cn("relative text-center text-sm", className)}>
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border" />
      </div>
      <div className="relative z-10">
        <span className="bg-card px-2 text-muted-foreground">
          {text}
        </span>
      </div>
    </div>
  );
}