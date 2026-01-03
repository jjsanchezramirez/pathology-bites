// src/shared/contexts/notification-refresh-context.tsx
"use client";

import { createContext, useContext, useCallback, useState } from "react";

interface NotificationRefreshContextType {
  refreshNotifications: () => void;
  registerRefreshHandler: (handler: () => void) => void;
}

const NotificationRefreshContext = createContext<NotificationRefreshContextType | null>(null);

export function NotificationRefreshProvider({ children }: { children: React.ReactNode }) {
  const [refreshHandler, setRefreshHandler] = useState<(() => void) | null>(null);

  const registerRefreshHandler = useCallback((handler: () => void) => {
    setRefreshHandler(() => handler);
  }, []);

  const refreshNotifications = useCallback(() => {
    if (refreshHandler) {
      refreshHandler();
    }
  }, [refreshHandler]);

  return (
    <NotificationRefreshContext.Provider value={{ refreshNotifications, registerRefreshHandler }}>
      {children}
    </NotificationRefreshContext.Provider>
  );
}

export function useNotificationRefresh() {
  const context = useContext(NotificationRefreshContext);
  if (!context) {
    // Return a no-op function if context is not available
    return { refreshNotifications: () => {}, registerRefreshHandler: () => {} };
  }
  return context;
}
