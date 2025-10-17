"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  // Force light theme for toasts to ensure consistent appearance
  // The theme prop controls the toast styling, not the page theme
  const toastTheme = "light" as const

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
        className: "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
        descriptionClassName: "group-[.toast]:text-muted-foreground",
      }}
      {...props}
    />
  )
}

export { Toaster }
