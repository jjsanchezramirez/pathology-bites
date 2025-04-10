// src/components/auth/auth-page-layout.tsx
import { Microscope } from "lucide-react"
import Link from "next/link"
import { ReactNode } from "react"

interface AuthPageLayoutProps {
  children: ReactNode;
  maxWidth?: "xs" | "sm" | "md" | "lg";
}

export function AuthPageLayout({ 
  children, 
  maxWidth = "md" 
}: AuthPageLayoutProps) {
  // Map maxWidth prop to actual width classes
  const widthClasses = {
    xs: "max-w-xs",
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Background patterns */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(56,189,248,0.08),transparent_25%),radial-gradient(circle_at_70%_50%,rgba(56,189,248,0.08),transparent_25%),linear-gradient(to_bottom,rgba(56,189,248,0.05),transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-[0.15]" />
      
      {/* Content container */}
      <div className="relative flex flex-col items-center justify-center min-h-screen p-6">
        <div className={`w-full ${widthClasses[maxWidth]} space-y-8`}>
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 justify-center hover:opacity-80 transition-opacity">
            <Microscope className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Pathology Bites
            </span>
          </Link>
          
          {/* Page content */}
          {children}
        </div>
      </div>
    </div>
  );
}