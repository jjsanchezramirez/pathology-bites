// src/components/ui/loading-spinner.tsx
import { Icons } from "@/components/theme/icons"
import { cn } from "@/lib/utils"

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  center?: boolean;
  text?: string;
  className?: string;
}

export function LoadingSpinner({
  size = "md",
  center = true,
  text,
  className,
}: LoadingSpinnerProps) {
  // Size classes
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };

  // Container classes for centering
  const containerClasses = center
    ? "flex flex-col items-center justify-center"
    : "";

  return (
    <div className={cn(containerClasses, className)}>
      <Icons.spinner className={cn(sizeClasses[size], "animate-spin text-primary")} />
      {text && (
        <p className="mt-2 text-sm text-muted-foreground">{text}</p>
      )}
    </div>
  );
}