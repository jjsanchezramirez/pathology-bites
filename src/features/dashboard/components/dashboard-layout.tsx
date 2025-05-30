// src/components/dashboard/dashboard-layout.tsx
"use client"

import { useState } from "react"
import { Header } from "@/features/dashboard/components/header"
import { Sidebar } from "@/features/dashboard/components/sidebar"
import { cn } from "@/shared/utils"

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [isOpen, setIsOpen] = useState(true)
  
  return (
    <div className="min-h-screen bg-background">
      <Sidebar isOpen={isOpen} />
      <Header 
        isOpen={isOpen} 
        onMenuClick={() => setIsOpen(!isOpen)}
      />
      <main className={cn(
        "transition-all duration-300 ease-in-out",
        "min-h-screen bg-background",
        isOpen ? "ml-64" : "ml-20",
        "pt-24 px-8" // Increased padding
      )}>
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}