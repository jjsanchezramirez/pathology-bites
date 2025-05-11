// src/app/(public)/layout.tsx
'use client'

import { useEffect } from 'react'
import { Navbar } from "@/components/layout/navbar"
import { Footer } from "@/components/layout/footer"

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Additional enforcement of light theme for public pages
  useEffect(() => {
    // Ensure dark mode is never applied to public pages
    document.documentElement.classList.remove('dark')
    document.documentElement.style.colorScheme = 'light'
    
    // Force light theme in localStorage to prevent flicker on refresh
    if (typeof window !== 'undefined' && window.localStorage) {
      const currentTheme = localStorage.getItem('theme')
      if (currentTheme === 'dark') {
        localStorage.setItem('theme', 'light')
      }
    }
  }, [])

  return (
    <>
      <Navbar />
      <main>{children}</main>
      <Footer />
    </>
  )
}