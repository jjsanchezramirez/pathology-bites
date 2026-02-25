// src/shared/components/common/admin-mode-toggle.tsx
"use client";

import { useState } from "react";
import { Button } from "@/shared/components/ui/button";

import { Shield, User, PenTool, Eye } from "lucide-react";
import { useUserRole } from "@/shared/hooks/use-user-role";
import { useDashboardTheme } from "@/shared/contexts/dashboard-theme-context";
import { useRouter } from "next/navigation";

export function AdminModeToggle() {
  const { isAdmin, isCreator, isReviewer, role } = useUserRole();
  const { adminMode, setAdminMode, isTransitioning, setTransitioning } = useDashboardTheme();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  // Only show for admin, creator, or reviewer users - ALL HOOKS MUST BE CALLED BEFORE THIS
  if (!isAdmin && !isCreator && !isReviewer) return null;

  // Determine if currently in admin-type mode
  const isInAdminMode =
    adminMode === "admin" || adminMode === "creator" || adminMode === "reviewer";
  const isInStudentMode = adminMode === "user";

  const switchToMode = async (newMode: "admin" | "user") => {
    // Map 'admin' to actual role
    const targetMode = newMode === "admin" ? (role as "admin" | "creator" | "reviewer") : "user";

    if (targetMode === adminMode) return; // Already in this mode

    try {
      setIsLoading(true);
      setTransitioning(true);

      // Update admin mode first (this will also handle theme switching)
      setAdminMode(targetMode);

      // Navigate to appropriate dashboard
      if (newMode === "admin") {
        router.push("/admin");
      } else {
        router.push("/dashboard");
      }

      // Don't clear transition flag here - let the destination page clear it when ready
      // This prevents showing hybrid content during navigation
      setIsLoading(false);
    } catch (error) {
      console.error("Error switching mode:", error);
      setIsLoading(false);
      setTransitioning(false);
    }
  };

  // Get role label based on actual user role
  const getRoleLabel = () => {
    if (isAdmin) return "Admin";
    if (isCreator) return "Creator";
    if (isReviewer) return "Reviewer";
    return "Student";
  };

  // Get role icon based on actual user role
  const getRoleIcon = () => {
    if (isAdmin) return Shield;
    if (isCreator) return PenTool;
    if (isReviewer) return Eye;
    return User;
  };

  const modes = [
    { key: "admin", label: getRoleLabel(), icon: getRoleIcon() },
    { key: "user", label: "Student", icon: User },
  ];

  return (
    <div className="flex items-center bg-muted/20 rounded-lg p-1 gap-0.5">
      {modes.map(({ key, label, icon: Icon }) => {
        const isActive = key === "admin" ? isInAdminMode : isInStudentMode;

        return (
          <Button
            key={key}
            variant={isActive ? "default" : "ghost"}
            size="sm"
            onClick={() => switchToMode(key as "admin" | "user")}
            disabled={isLoading || isTransitioning}
            className={`
              h-7 px-3 text-xs font-medium transition-all duration-200
              ${
                isActive
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }
            `}
          >
            <Icon className="h-3 w-3 mr-1.5" />
            {label}
          </Button>
        );
      })}
    </div>
  );
}
