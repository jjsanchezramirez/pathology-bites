// src/shared/components/common/loading-spinner.tsx
import { cn } from "@/shared/utils"
import { Icons } from "@/shared/components/common/icons"

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg"
  text?: string
  className?: string
  textClassName?: string
  centered?: boolean
}

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-6 w-6", 
  lg: "h-8 w-8"
}

export function LoadingSpinner({
  size = "md",
  text,
  className,
  textClassName,
  centered = true
}: LoadingSpinnerProps) {
  const content = (
    <>
      <Icons.spinner className={cn("animate-spin text-muted-foreground", sizeClasses[size])} />
      {text && (
        <p className={cn("text-sm text-muted-foreground", textClassName)}>
          {text}
        </p>
      )}
    </>
  )

  if (centered) {
    return (
      <div className={cn("flex flex-col items-center justify-center space-y-2", className)}>
        {content}
      </div>
    )
  }

  return (
    <div className={cn("flex items-center space-x-2", className)}>
      {content}
    </div>
  )
}
