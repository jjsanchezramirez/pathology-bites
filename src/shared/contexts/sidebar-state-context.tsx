// src/shared/contexts/sidebar-state-context.tsx
"use client";

import { createContext, useContext, ReactNode } from "react";

interface SidebarStateContextType {
  isCollapsed: boolean;
  isHovered: boolean;
  isMobile: boolean;
}

const SidebarStateContext = createContext<SidebarStateContextType | undefined>(undefined);

export function SidebarStateProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: SidebarStateContextType;
}) {
  return <SidebarStateContext.Provider value={value}>{children}</SidebarStateContext.Provider>;
}

export function useSidebarState() {
  const context = useContext(SidebarStateContext);
  if (context === undefined) {
    throw new Error("useSidebarState must be used within SidebarStateProvider");
  }
  return context;
}
