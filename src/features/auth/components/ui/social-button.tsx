// src/components/auth/social-button.tsx
import { ReactNode } from "react"
import { Button } from "@/shared/components/ui/button"
import { Icons } from "@/shared/components/common/icons"
import { cn } from "@/shared/utils"

interface SocialButtonProps {
  provider: "google" | "github" | "twitter" | "facebook";
  onClick?: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
  label?: string;
}

export function SocialButton({
  provider,
  onClick,
  isLoading = false,
  disabled = false,
  className,
  label,
}: SocialButtonProps) {
  // Provider-specific props
  const providerProps: {
    [key: string]: {
      icon: ReactNode;
      defaultLabel: string;
    };
  } = {
    google: {
      icon: <Icons.google className="mr-2 h-4 w-4" />,
      defaultLabel: "Continue with Google",
    },
    github: {
      icon: <Icons.github className="mr-2 h-4 w-4" />,
      defaultLabel: "Continue with GitHub",
    },
    twitter: {
      icon: <Icons.twitter className="mr-2 h-4 w-4" />,
      defaultLabel: "Continue with Twitter",
    },
    facebook: {
      icon: <Icons.facebook className="mr-2 h-4 w-4" />,
      defaultLabel: "Continue with Facebook",
    },
  };

  // Get props for the selected provider
  const { icon, defaultLabel } = providerProps[provider];
  
  // Use custom label or default
  const buttonLabel = label || defaultLabel;

  return (
    <Button
      type="button"
      variant="outline"
      className={cn("w-full", className)}
      onClick={onClick}
      disabled={isLoading || disabled}
    >
      {isLoading ? (
        <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        icon
      )}
      {buttonLabel}
    </Button>
  );
}