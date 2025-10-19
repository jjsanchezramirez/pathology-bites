// src/app/(auth)/layout.tsx
'use client'

import { useEffect } from 'react'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Enforce light mode and default dashboard theme on auth pages
  useEffect(() => {
    const html = document.documentElement

    // Force light color mode
    html.classList.remove('dark')
    html.classList.add('light')

    // Enforce default dashboard theme by setting localStorage
    // This ensures the default theme is used if DashboardThemeProvider is ever instantiated
    const uiSettingsStr = localStorage.getItem('pathology-bites-ui-settings')
    const uiSettings = uiSettingsStr ? JSON.parse(uiSettingsStr) : {}

    // Set default theme for both admin and user modes
    uiSettings.dashboard_theme_admin = 'default'
    uiSettings.dashboard_theme_user = 'default'

    localStorage.setItem('pathology-bites-ui-settings', JSON.stringify(uiSettings))

    // Set data attribute to identify forced theme state
    html.setAttribute('data-auth-layout-enforced', 'true')
  }, [])

  // The layout is now only a simple wrapper
  // Most styling will be handled by AuthPageLayout component
  return children
}