// src/shared/components/layout/layout-sidebar.tsx
"use client";

import { UnifiedSidebar } from "./unified-sidebar";
import type { SidebarController } from "./use-sidebar-controller";
import type { NavigationSection } from "@/shared/config/navigation";

interface LayoutSidebarProps {
  controller: SidebarController;
  navigationSections: NavigationSection[];
  hideAuthStatus?: boolean;
}

/**
 * Sidebar placement for the unified shell. Mobile overlays a sliding panel over
 * a backdrop; desktop renders a static rail that expands on hover.
 */
export function LayoutSidebar({
  controller,
  navigationSections,
  hideAuthStatus,
}: LayoutSidebarProps) {
  const {
    isMobile,
    desktopCollapsed,
    mobileVisible,
    isHovered,
    setHovered,
    hideMobileSidebar,
    sidebarRef,
  } = controller;

  if (isMobile) {
    return (
      <>
        {/* Backdrop — subtle dark tint with blur */}
        {mobileVisible && (
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-md z-40 transition-all duration-300 ease-in-out"
            onClick={hideMobileSidebar}
          />
        )}

        {/* Always mounted; slides in and out via transform */}
        <div
          ref={sidebarRef}
          className={`fixed left-0 top-0 z-50 transform transition-transform duration-300 ease-in-out ${
            mobileVisible ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <UnifiedSidebar
            isCollapsed={false}
            navigationSections={navigationSections}
            isMobileMode
            hideAuthStatus={hideAuthStatus}
          />
        </div>
      </>
    );
  }

  return (
    <div
      ref={sidebarRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <UnifiedSidebar
        isCollapsed={desktopCollapsed}
        isHovered={isHovered}
        navigationSections={navigationSections}
        isMobileMode={false}
        hideAuthStatus={hideAuthStatus}
      />
    </div>
  );
}
