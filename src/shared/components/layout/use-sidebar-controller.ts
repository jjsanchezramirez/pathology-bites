// src/shared/components/layout/use-sidebar-controller.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useMobile } from "@/shared/hooks/use-mobile";
import { useQuizMode, useAnkiMode, useLessonStudioMode } from "@/shared/hooks/use-quiz-mode";
import { log } from "@/shared/utils/logging";

// Give navigation a beat to start before the mobile panel animates away.
const MOBILE_LINK_CLOSE_DELAY_MS = 100;

export interface SidebarController {
  /** Viewport is mobile. Reads false until useMobile() resolves after hydration. */
  isMobile: boolean;
  /** Desktop rail state; mobile always renders the sidebar expanded. */
  desktopCollapsed: boolean;
  mobileVisible: boolean;
  isHovered: boolean;
  setHovered: (hovered: boolean) => void;
  hideMobileSidebar: () => void;
  toggleSidebar: () => void;
  /** Attach to the sidebar wrapper so outside clicks can be detected. */
  sidebarRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Owns every piece of sidebar state: desktop collapse, mobile visibility, hover,
 * and the auto-collapse/restore around quiz, anki and lesson-studio sessions.
 */
export function useSidebarController(): SidebarController {
  const { isInQuizMode } = useQuizMode();
  const { isInAnkiMode } = useAnkiMode();
  const { isInLessonStudioMode } = useLessonStudioMode();
  const isInSpecialMode = isInQuizMode || isInAnkiMode || isInLessonStudioMode;

  // Treat undefined (pre-hydration) as false (desktop) so SSR and the first
  // client render agree, eliminating the hydration mismatch. Effects wait for
  // the real value instead of acting on that placeholder.
  const isMobileRaw = useMobile();
  const isMobile = isMobileRaw ?? false;
  const isViewportKnown = isMobileRaw !== undefined;

  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [mobileVisible, setMobileVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Mirror of desktopCollapsed so the special-mode effect can read the live
  // value without re-running on every collapse toggle.
  const desktopCollapsedRef = useRef(desktopCollapsed);
  desktopCollapsedRef.current = desktopCollapsed;

  const preSpecialModeCollapsedRef = useRef(false);
  const wasInSpecialModeRef = useRef(false);

  // Collapse while in a special mode, restore the prior state on exit.
  // Desktop only — mobile hides the sidebar outright instead.
  useEffect(() => {
    if (isMobile || !isViewportKnown) return;

    if (isInSpecialMode && !wasInSpecialModeRef.current) {
      preSpecialModeCollapsedRef.current = desktopCollapsedRef.current;
      wasInSpecialModeRef.current = true;
      setDesktopCollapsed(true);
      log.debug("[Sidebar] Entering special mode, saving state:", desktopCollapsedRef.current);
    } else if (!isInSpecialMode && wasInSpecialModeRef.current) {
      wasInSpecialModeRef.current = false;
      setDesktopCollapsed(preSpecialModeCollapsedRef.current);
      log.debug(
        "[Sidebar] Exiting special mode, restoring state:",
        preSpecialModeCollapsedRef.current
      );
    }
  }, [isInSpecialMode, isMobile, isViewportKnown]);

  // Mobile: dismiss on an outside click, or just after a nav link is followed.
  useEffect(() => {
    if (!isMobile || !mobileVisible) return;

    const handleMouseDown = (event: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        setMobileVisible(false);
      }
    };
    const handleClick = (event: MouseEvent) => {
      if ((event.target as HTMLElement).closest("a")) {
        setTimeout(() => setMobileVisible(false), MOBILE_LINK_CLOSE_DELAY_MS);
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("click", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("click", handleClick);
    };
  }, [isMobile, mobileVisible]);

  const toggleSidebar = useCallback(() => {
    if (isMobile) {
      setMobileVisible((visible) => !visible);
    } else if (!isInSpecialMode) {
      // Desktop: the rail stays collapsed for the duration of a special mode.
      setDesktopCollapsed((collapsed) => !collapsed);
    }
  }, [isMobile, isInSpecialMode]);

  const hideMobileSidebar = useCallback(() => setMobileVisible(false), []);

  return {
    isMobile,
    desktopCollapsed,
    mobileVisible,
    isHovered,
    setHovered: setIsHovered,
    hideMobileSidebar,
    toggleSidebar,
    sidebarRef,
  };
}
