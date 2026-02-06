// src/shared/components/common/conditional-theme-provider.tsx
/**
 * ConditionalThemeProvider
 *
 * Simplified theme provider that enforces light mode on public pages
 * and allows user-controlled themes on authenticated pages.
 *
 * THEME RULES:
 * -----------
 * - Public pages (/): FORCED light mode + default theme
 * - Auth pages (/login, /signup, etc.): FORCED light mode + default theme
 * - Error pages (/not-found, etc.): FORCED light mode + default theme
 * - Dashboard (/dashboard/*): User can toggle light/dark/system
 * - Admin (/admin/*): User can toggle light/dark/system
 *
 * NOTE: Dashboard theme colors (notebook/tangerine) are managed separately
 * by DashboardThemeContext, not by this provider.
 */
"use client";

import { usePathname } from "next/navigation";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ThemeProviderProps } from "next-themes";
import { useEffect, useState } from "react";

/**
 * Check if a route should allow user theme control
 */
function isUserThemedRoute(pathname: string | null): boolean {
  if (!pathname) return false;

  // Only dashboard and admin routes allow user theme control
  return pathname.startsWith("/dashboard") || pathname.startsWith("/admin");
}

export function ConditionalThemeProvider({ children, ...props }: ThemeProviderProps) {
  const pathname = usePathname();
  const allowUserTheme = isUserThemedRoute(pathname);
  const [isErrorPage, setIsErrorPage] = useState(false);

  // Check if we're on an error page (error.tsx sets data-error-page-enforced attribute)
  useEffect(() => {
    const checkErrorPage = () => {
      const hasErrorAttr = document.documentElement.hasAttribute("data-error-page-enforced");
      setIsErrorPage(hasErrorAttr);
    };

    checkErrorPage();

    // Watch for attribute changes (when error page mounts/unmounts)
    const observer = new MutationObserver(checkErrorPage);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-error-page-enforced"],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem={true}
      disableTransitionOnChange={false}
      storageKey="pathology-bites-theme"
      forcedTheme={allowUserTheme && !isErrorPage ? undefined : "light"}
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
