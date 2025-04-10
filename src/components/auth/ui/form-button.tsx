// src/components/auth/form-button.tsx
import { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Icons } from "@/components/theme/icons"
import { cn } from "@/lib/utils"

interface FormButtonProps {
  children: ReactNode;
  isLoading?: boolean;
  loadingText?: string;
  type?: "submit" | "button" | "reset";
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  className?: string;
  fullWidth?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  icon?: ReactNode;
}

export function FormButton({
  children,
  isLoading = false,
  loadingText,
  type = "submit",
  variant = "default",
  className,
  fullWidth = false,
  disabled = false,
  onClick,
  icon,
}: FormButtonProps) {
  return (
    <Button
      type={type}
      variant={variant}
      className={cn(fullWidth ? "w-full" : "", className)}
      disabled={isLoading || disabled}
      onClick={onClick}
    >
      {isLoading ? (
        <>
          <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
          {loadingText || children}
        </>
      ) : (
        <>
          {icon && <span className="mr-2">{icon}</span>}
          {children}
        </>
      )}
    </Button>
  )
}