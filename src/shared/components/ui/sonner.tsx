"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();
  const [isPublicPage, setIsPublicPage] = useState(false);

  // Detect if we're on a public page that enforces light mode
  useEffect(() => {
    const enforced =
      document.documentElement.getAttribute("data-public-layout-enforced") === "true";
    setIsPublicPage(enforced);
  }, []);

  // Determine toast theme:
  // - On public pages (with enforced light mode): use light theme
  // - On authenticated pages: follow user's theme preference
  const toastTheme = isPublicPage ? "light" : (theme as "light" | "dark" | "system");

  return (
    <Sonner
      theme={toastTheme}
      className="toaster group"
      position="bottom-right"
      richColors
      expand={true}
      visibleToasts={4}
      closeButton
      toastOptions={{
        duration: 8000, // Increased from 4000ms to 8000ms (8 seconds)
        className:
          "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
        descriptionClassName: "group-[.toast]:text-muted-foreground",
        style: {
          // Ensure toasts are always visible with high z-index
          zIndex: 999999,
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
