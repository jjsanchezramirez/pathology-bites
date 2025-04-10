// src/components/auth/auth-card.tsx
import { ReactNode } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface AuthCardProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  footerClassName?: string;
  showPrivacyFooter?: boolean;
}

export function AuthCard({
  title,
  description,
  icon,
  children,
  footer,
  className,
  footerClassName,
  showPrivacyFooter = false,
}: AuthCardProps) {
  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <Card>
        <CardHeader className="text-center">
          {icon && (
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              {icon}
            </div>
          )}
          <CardTitle className="text-xl">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>
          {children}
        </CardContent>
        {footer && (
          <CardFooter className={cn("justify-center", footerClassName)}>
            {footer}
          </CardFooter>
        )}
      </Card>
      
      {showPrivacyFooter && (
        <div className="text-balance text-center text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 [&_a]:hover:text-primary">
          By clicking continue, you agree to our{" "}
          <Link href="/terms" tabIndex={0}>Terms of Service</Link>{" "}
          and{" "}
          <Link href="/privacy" tabIndex={0}>Privacy Policy</Link>.
        </div>
      )}
    </div>
  )
}