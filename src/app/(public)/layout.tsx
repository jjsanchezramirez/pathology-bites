// src/app/(public)/layout.tsx
'use client'

import { useEffect } from 'react'
import { Navbar } from "@/shared/components/layout/navbar"
import { Footer } from "@/shared/components/layout/footer"

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Enforce light mode and default dashboard theme on public pages
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
    html.setAttribute('data-public-layout-enforced', 'true')
  }, [])

  return (
    <>
      <Navbar />
      <main>{children}</main>
      <Footer />
    </>
  )
}