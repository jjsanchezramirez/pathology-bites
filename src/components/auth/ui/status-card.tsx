// src/components/auth/status-card.tsx
import { ReactNode } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface StatusCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  content?: string;
  footer?: ReactNode;
  variant?: "default" | "success" | "error" | "warning" | "info";
  className?: string;
}

export function StatusCard({
  title,
  description,
  icon,
  content,
  footer,
  variant = "default",
  className,
}: StatusCardProps) {
  // Determine icon background color based on variant
  const iconClasses = {
    default: "bg-primary/10",
    success: "bg-green-100 dark:bg-green-900",
    error: "bg-red-100 dark:bg-red-900",
    warning: "bg-yellow-100 dark:bg-yellow-900",
    info: "bg-blue-100 dark:bg-blue-900",
  }
  
  // Determine icon text color based on variant
  const iconTextClasses = {
    default: "text-primary",
    success: "text-green-600 dark:text-green-400",
    error: "text-red-600 dark:text-red-400",
    warning: "text-yellow-600 dark:text-yellow-400",
    info: "text-blue-600 dark:text-blue-400",
  }

  return (
    <Card className={className}>
      <CardHeader className="text-center">
        <div className={cn("mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full", iconClasses[variant])}>
          <div className={iconTextClasses[variant]}>
            {icon}
          </div>
        </div>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>
          {description}
        </CardDescription>
      </CardHeader>
      {content && (
        <CardContent className="text-center">
          <p className="text-sm text-muted-foreground">
            {content}
          </p>
        </CardContent>
      )}
      {footer && (
        <CardFooter className="flex justify-center">
          {footer}
        </CardFooter>
      )}
    </Card>
  )
}