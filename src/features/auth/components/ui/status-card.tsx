// src/components/auth/status-card.tsx
import { ReactNode } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/shared/components/ui/card"

interface StatusCardProps {
  title: string;
  description: ReactNode; // Changed from string to ReactNode
  content?: ReactNode; // Changed from string to ReactNode
  footer?: ReactNode;
  variant?: "default" | "success" | "error" | "warning" | "info";
  className?: string;
}

export function StatusCard({
  title,
  description,
  content,
  footer,
  className,
}: StatusCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>
          {description}
        </CardDescription>
      </CardHeader>
      {content && (
        <CardContent className="text-center">
          <div className="text-sm text-muted-foreground">
            {content}
          </div>
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