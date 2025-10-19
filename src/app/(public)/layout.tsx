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
  // Enforce light mode on public pages (but NOT dashboard theme)
  // Dashboard theme should be loaded from database when user navigates to dashboard
  useEffect(() => {
    const html = document.documentElement

    // Force light color mode
    html.classList.remove('dark')
    html.classList.add('light')

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