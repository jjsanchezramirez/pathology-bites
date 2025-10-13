// src/shared/contexts/role-switch-context.tsx
'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'

interface RoleSwitchContextType {
  isSwitching: boolean
  switchRole: (newMode: 'admin' | 'user', setAdminMode: (mode: 'admin' | 'user') => void) => void
}

const RoleSwitchContext = createContext<RoleSwitchContextType | undefined>(undefined)

export function useRoleSwitch() {
  const context = useContext(RoleSwitchContext)
  if (!context) {
    throw new Error('useRoleSwitch must be used within RoleSwitchProvider')
  }
  return context
}

interface RoleSwitchProviderProps {
  children: React.ReactNode
}

export function RoleSwitchProvider({ children }: RoleSwitchProviderProps) {
  const [isSwitching, setIsSwitching] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  // Clear switching state when pathname changes (page loaded)
  useEffect(() => {
    if (isSwitching) {
      setIsSwitching(false)
    }
  }, [pathname])

  const switchRole = useCallback(async (newMode: 'admin' | 'user', setAdminMode: (mode: 'admin' | 'user') => void) => {
    // 1. Show loading state immediately
    setIsSwitching(true)

    // 2. Change theme (this also sets the cookie)
    setAdminMode(newMode)

    // 3. Small delay to ensure cookie is set
    await new Promise(resolve => setTimeout(resolve, 100))

    // 4. Navigate to new page
    const targetPath = newMode === 'admin' ? '/admin/dashboard' : '/dashboard'
    router.push(targetPath)

    // isSwitching will be cleared by the useEffect when pathname changes
  }, [router])

  return (
    <RoleSwitchContext.Provider value={{ isSwitching, switchRole }}>
      {children}
    </RoleSwitchContext.Provider>
  )
}

