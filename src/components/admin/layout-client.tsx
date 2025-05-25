// src/components/admin/layout-client.tsx
'use client'

import { useState } from 'react'
import { AdminSidebar } from './sidebar'
import { AdminHeader } from './header'

export function AdminLayoutClient({
  children,
}: {
  children: React.ReactNode
}) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  return (
    <div className="h-screen overflow-hidden bg-background">
      {/* Fixed Sidebar */}
      <AdminSidebar isCollapsed={isSidebarCollapsed} />

      {/* Main Content Area */}
      <div 
        className={`fixed top-0 right-0 bottom-0 flex flex-col transition-all duration-300 ${
          isSidebarCollapsed ? 'left-16' : 'left-64'
        }`}
      >
        {/* Fixed Header */}
        <AdminHeader onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)} />

        {/* Scrollable Content */}
        <main className="flex-1 overflow-auto bg-background">
          {/* Background Effects */}
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(56,189,248,0.13),transparent_25%)] pointer-events-none" />
          
          {/* Content */}
          <div className="relative p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}