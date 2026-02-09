// src/components/theme/theme-mode-toggle.tsx
"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { usePathname } from "next/navigation";
import { Button } from "@/shared/components/ui/button";
import { useEffect, useState } from "react";
import { useSWRConfig } from "swr";
import { userSettingsService } from "@/shared/services/user-settings";

export function ThemeModeToggle() {
  const { theme, setTheme, forcedTheme } = useTheme();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const { mutate } = useSWRConfig();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Only show on dashboard and admin routes where users can control theme
  const isUserThemedRoute = pathname?.startsWith("/dashboard") || pathname?.startsWith("/admin");

  // Don't render until mounted to prevent hydration mismatch
  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="hover:bg-primary/10" disabled>
        <Sun size={20} className="transition-all opacity-50" />
      </Button>
    );
  }

  // Don't show toggle if theme is forced (public/auth/error pages)
  if (!isUserThemedRoute || forcedTheme) {
    return null;
  }

  const cycleTheme = () => {
    let newTheme: string;
    switch (theme) {
      case "light":
        newTheme = "dark";
        break;
      case "dark":
        newTheme = "system";
        break;
      case "system":
      default:
        newTheme = "light";
        break;
    }

    // Update next-themes (localStorage + UI) - this should happen immediately
    setTheme(newTheme);

    // Update database and invalidate SWR cache
    userSettingsService
      .updateUISettings({ theme: newTheme })
      .then(() => {
        mutate("user-settings");
      })
      .catch((error) => {
        console.error("[ThemeModeToggle] Failed to save theme:", error);
        // Theme already changed in UI, so we don't need to revert
      });
  };

  const getIcon = () => {
    switch (theme) {
      case "light":
        return <Sun size={20} className="transition-all" />;
      case "dark":
        return <Moon size={20} className="transition-all" />;
      case "system":
      default:
        return <Monitor size={20} className="transition-all" />;
    }
  };

  const getTitle = () => {
    switch (theme) {
      case "light":
        return "Switch to dark mode";
      case "dark":
        return "Switch to system mode";
      case "system":
      default:
        return "Switch to light mode";
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycleTheme}
      className="hover:bg-primary/10"
      title={getTitle()}
    >
      {getIcon()}
    </Button>
  );
}
