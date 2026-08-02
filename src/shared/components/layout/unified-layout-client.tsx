// src/shared/components/layout/unified-layout-client.tsx
"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";

import { UnifiedHeader, HeaderConfig } from "./unified-header";
import { LayoutSidebar } from "./layout-sidebar";
import { isFullHeightPath } from "./layout-routes";
import { useSidebarController } from "./use-sidebar-controller";
import { getNavigationConfig, type NavigationSection } from "@/shared/config/navigation";
import { SidebarStateProvider } from "@/shared/contexts/sidebar-state-context";
import { useDashboardTheme } from "@/shared/contexts/dashboard-theme-context";

interface UnifiedLayoutClientProps {
  children: React.ReactNode;
  headerConfig?: HeaderConfig;
  navigationOverride?: NavigationSection[];
  hideAuthStatus?: boolean;
}

// 100svh excludes the mobile address bar; 100vh is the fallback for browsers
// without svh support.
const SHELL_HEIGHT: React.CSSProperties = { height: "100svh", minHeight: "100vh" };

export function UnifiedLayoutClient({
  children,
  headerConfig,
  navigationOverride,
  hideAuthStatus,
}: UnifiedLayoutClientProps) {
  const pathname = usePathname();
  const { adminMode } = useDashboardTheme();
  const sidebar = useSidebarController();

  const isFullHeightPage = isFullHeightPath(pathname);

  // Navigation follows the live adminMode from DashboardThemeProvider (which
  // tracks the URL), so it updates correctly across admin <-> user transitions.
  const navigationSections = useMemo(
    () => navigationOverride ?? getNavigationConfig(adminMode).sections,
    [navigationOverride, adminMode]
  );

  const sidebarState = useMemo(
    () => ({
      isCollapsed: sidebar.desktopCollapsed,
      isHovered: sidebar.isHovered,
      isMobile: sidebar.isMobile,
    }),
    [sidebar.desktopCollapsed, sidebar.isHovered, sidebar.isMobile]
  );

  // Mobile: full width, the sidebar overlays it. Desktop: 64px collapsed rail,
  // 256px expanded or hovered.
  const contentInset = sidebar.isMobile
    ? "left-0"
    : sidebar.desktopCollapsed && !sidebar.isHovered
      ? "left-16"
      : "left-64";

  return (
    <div className="overflow-hidden bg-background" style={SHELL_HEIGHT}>
      <LayoutSidebar
        controller={sidebar}
        navigationSections={navigationSections}
        hideAuthStatus={hideAuthStatus}
      />

      <SidebarStateProvider value={sidebarState}>
        <div
          className={`fixed top-0 right-0 flex flex-col transition-all duration-300 ease-in-out ${contentInset}`}
          style={SHELL_HEIGHT}
        >
          <UnifiedHeader onToggleSidebar={sidebar.toggleSidebar} config={headerConfig} />

          <main
            className={
              isFullHeightPage
                ? "flex-1 overflow-hidden bg-background"
                : "flex-1 overflow-y-auto bg-background"
            }
          >
            {isFullHeightPage ? (
              <div className="h-full">{children}</div>
            ) : (
              <div className="mx-auto max-w-7xl px-4 py-4 pb-24 md:p-6 md:pb-24">{children}</div>
            )}
          </main>
        </div>
      </SidebarStateProvider>
    </div>
  );
}
