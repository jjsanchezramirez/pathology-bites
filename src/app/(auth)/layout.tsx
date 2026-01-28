// src/app/(auth)/layout.tsx
"use client";

import { useEffect } from "react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  // Enforce light mode and system theme on auth pages (but NOT dashboard theme)
  // Dashboard theme should be loaded from database when user navigates to dashboard
  useEffect(() => {
    const html = document.documentElement;

    // Force light color mode
    html.classList.remove("dark");
    html.classList.add("light");

    // Enforce system theme (blue theme, not user's dashboard theme)
    html.setAttribute("data-theme", "system");

    // Set data attribute to identify forced theme state
    html.setAttribute("data-auth-layout-enforced", "true");
  }, []);

  // The layout is now only a simple wrapper
  // Most styling will be handled by AuthPageLayout component
  return children;
}
