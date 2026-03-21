// src/shared/components/layout/unified-layout-client.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { useMobile } from "@/shared/hooks/use-mobile";
import { useQuizMode, useAnkiMode } from "@/shared/hooks/use-quiz-mode";
import { UnifiedSidebar } from "./unified-sidebar";
import { UnifiedHeader, HeaderConfig } from "./unified-header";
import { getNavigationConfig } from "@/shared/config/navigation";
import { SidebarStateProvider } from "@/shared/contexts/sidebar-state-context";
import { useDashboardTheme } from "@/shared/contexts/dashboard-theme-context";
// import { useUserRole } from '@/shared/hooks/use-user-role' // Commented out - middleware already validates role server-side

interface UnifiedLayoutClientProps {
  children: React.ReactNode;
  userType: "admin" | "user";
  headerConfig?: HeaderConfig;
  navigationOverride?: import("@/shared/config/navigation").NavigationSection[];
  hideAuthStatus?: boolean;
}

// Simplified sidebar state enum
type _SidebarState = "hidden" | "collapsed" | "expanded";

export function UnifiedLayoutClient({
  children,
  userType,
  headerConfig,
  navigationOverride,
  hideAuthStatus,
}: UnifiedLayoutClientProps) {
  // const { role, isLoading } = useUserRole() // Commented out - middleware already validates role server-side
  const pathname = usePathname();
  const { adminMode } = useDashboardTheme();

  // Check if we're on pages that have their own full-height layouts
  const isAnkiPage = pathname === "/dashboard/anki" || pathname === "/uscap/anki";
  // Only quiz active session and review pages need full-height layout (they have their own scrolling areas)
  // Results page needs standard scrollable layout
  // Exclude /quiz/new - it needs scrollable layout
  const isQuizActivePage =
    (pathname?.match(/^\/dashboard\/quiz\/[^/]+$/) && pathname !== "/dashboard/quiz/new") ||
    pathname?.match(/^\/uscap\/quiz\/[^/]+$/); // Active quiz: /quiz/[id]
  const isQuizReviewPage =
    pathname?.match(/^\/dashboard\/quiz\/[^/]+\/review$/) ||
    pathname?.match(/^\/uscap\/quiz\/[^/]+\/review$/); // Review page: /quiz/[id]/review
  const isLessonStudioPage = pathname === "/admin/lesson-studio"; // Lesson Studio needs full-width
  const isFullHeightPage = isAnkiPage || isQuizActivePage || isQuizReviewPage || isLessonStudioPage;

  // Get navigation items based on admin mode (dynamic) instead of static userType
  // This ensures navigation updates correctly during mode transitions
  // If adminMode is not set yet, fall back to userType
  const isAdminTypeMode =
    adminMode === "admin" || adminMode === "creator" || adminMode === "reviewer";
  const effectiveMode =
    adminMode && adminMode !== "user" ? adminMode : userType === "admin" ? "admin" : "user";
  const navigationConfig = getNavigationConfig(
    isAdminTypeMode ? (effectiveMode as "admin" | "creator" | "reviewer") : "user"
  );
  const navigationSections = navigationOverride ?? navigationConfig.sections;
  const { isInQuizMode } = useQuizMode();
  const { isInAnkiMode } = useAnkiMode();
  const isMobileRaw = useMobile();
  // Treat undefined (pre-hydration) as false (desktop) so SSR and first client
  // render agree, eliminating the hydration mismatch.
  const isMobile = isMobileRaw ?? false;

  // Simplified state management - separate desktop and mobile states
  const [desktopCollapsed, setDesktopCollapsed] = useState(false); // Desktop: false = expanded, true = collapsed
  const [mobileVisible, setMobileVisible] = useState(false); // Mobile: false = hidden, true = visible
  const preQuizDesktopStateRef = useRef(false); // Store desktop state before quiz/anki mode
  const wasInSpecialModeRef = useRef(false); // Track if we were in quiz/anki mode
  const [isHydrated, setIsHydrated] = useState(false);
  const [sidebarHovered, setSidebarHovered] = useState(false); // Hover state for collapsed sidebar
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Handle hydration
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Handle quiz/anki mode changes on desktop only
  useEffect(() => {
    if (!isMobile && isHydrated) {
      const isInSpecialMode = isInQuizMode || isInAnkiMode;

      // Entering special mode (quiz or anki)
      if (isInSpecialMode && !wasInSpecialModeRef.current) {
        // Save current state and collapse
        preQuizDesktopStateRef.current = desktopCollapsed;
        wasInSpecialModeRef.current = true;
        setDesktopCollapsed(true);
        console.log("[Sidebar] Entering special mode, saving state:", desktopCollapsed);
      }
      // Exiting special mode
      else if (!isInSpecialMode && wasInSpecialModeRef.current) {
        // Restore previous state
        wasInSpecialModeRef.current = false;
        setDesktopCollapsed(preQuizDesktopStateRef.current);
        console.log(
          "[Sidebar] Exiting special mode, restoring state:",
          preQuizDesktopStateRef.current
        );
      }
    }
  }, [isInQuizMode, isInAnkiMode, isMobile, isHydrated, desktopCollapsed]);

  // Handle click outside to close mobile sidebar
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isMobile &&
        mobileVisible &&
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target as Node)
      ) {
        setMobileVisible(false);
      }
    };

    if (isMobile && mobileVisible) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isMobile, mobileVisible]);

  // Handle navigation link clicks on mobile (auto-hide sidebar)
  useEffect(() => {
    const handleLinkClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const link = target.closest("a");
      if (link && isMobile && mobileVisible) {
        // Small delay to allow navigation to start
        setTimeout(() => setMobileVisible(false), 100);
      }
    };

    if (isMobile && mobileVisible) {
      document.addEventListener("click", handleLinkClick);
      return () => document.removeEventListener("click", handleLinkClick);
    }
  }, [isMobile, mobileVisible]);

  // Handle sidebar toggle
  const handleToggleSidebar = () => {
    if (isMobile) {
      // On mobile: toggle visibility
      setMobileVisible(!mobileVisible);
    } else {
      // On desktop: toggle between collapsed and expanded (only if not in quiz/anki mode)
      if (!isInQuizMode && !isInAnkiMode) {
        setDesktopCollapsed(!desktopCollapsed);
      }
    }
  };

  // Determine final sidebar properties
  const sidebarCollapsed = isMobile ? false : desktopCollapsed; // Mobile always expanded when visible

  return (
    <div
      className="overflow-hidden bg-background"
      style={{
        height: "100svh", // Use small viewport height for mobile browsers (excludes address bar)
        minHeight: "100vh", // Fallback for browsers that don't support svh
      }}
    >
      {/* Mobile Backdrop - subtle dark tint with blur */}
      {isMobile && mobileVisible && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-md z-40 transition-all duration-300 ease-in-out"
          onClick={() => setMobileVisible(false)}
        />
      )}

      {/* Sidebar - different approach for desktop vs mobile */}
      {isMobile ? (
        // Mobile: Always render but use transforms for animation
        <div
          ref={sidebarRef}
          className={`fixed left-0 top-0 z-50 transform transition-transform duration-300 ease-in-out ${
            mobileVisible ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <UnifiedSidebar
            isCollapsed={sidebarCollapsed}
            navigationSections={navigationSections}
            isMobileMode={true}
            hideAuthStatus={hideAuthStatus}
          />
        </div>
      ) : (
        // Desktop: Always render, no transforms needed
        <div
          ref={sidebarRef}
          onMouseEnter={() => setSidebarHovered(true)}
          onMouseLeave={() => setSidebarHovered(false)}
        >
          <UnifiedSidebar
            isCollapsed={sidebarCollapsed}
            isHovered={sidebarHovered}
            navigationSections={navigationSections}
            isMobileMode={false}
            hideAuthStatus={hideAuthStatus}
          />
        </div>
      )}

      {/* Main Content Area */}
      <SidebarStateProvider
        value={{
          isCollapsed: desktopCollapsed,
          isHovered: sidebarHovered,
          isMobile,
        }}
      >
        <div
          className={`fixed top-0 right-0 flex flex-col transition-all duration-300 ease-in-out ${
            isMobile
              ? "left-0" // Mobile: always full width, sidebar overlays
              : desktopCollapsed && !sidebarHovered
                ? "left-16" // Desktop collapsed: 64px
                : "left-64" // Desktop expanded or hovered: 256px
          }`}
          style={{
            height: "100svh", // Use small viewport height for mobile browsers (excludes address bar)
            minHeight: "100vh", // Fallback for browsers that don't support svh
          }}
        >
          {/* Header */}
          <UnifiedHeader onToggleSidebar={handleToggleSidebar} config={headerConfig} />

          {/* Main Content */}
          <main
            className={
              isFullHeightPage
                ? "flex-1 overflow-hidden bg-background"
                : "flex-1 overflow-y-auto bg-background"
            }
          >
            {isFullHeightPage ? (
              // Anki/Anki2 pages: no padding, no scroll
              <div className="h-full">{children}</div>
            ) : (
              // Other pages: default padding with scroll
              <div className="container mx-auto max-w-7xl p-6 pb-24">{children}</div>
            )}
          </main>
        </div>
      </SidebarStateProvider>
    </div>
  );
}
