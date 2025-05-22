// src/components/auth/auth-debug.tsx
"use client"

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface DebugState {
  hasSession: boolean
  userId: string | null
  cookies: string[]
  timestamp: string
}

export function AuthDebug() {
  const [debug, setDebug] = useState<DebugState>({
    hasSession: false,
    userId: null,
    cookies: [],
    timestamp: new Date().toISOString()
  })

  useEffect(() => {
    async function checkAuth() {
      try {
        const supabase = createClient()
        const { data } = await supabase.auth.getSession()
        
        // Get auth cookies
        const cookies = document.cookie.split(';')
          .map(c => c.trim())
          .filter(c => c.startsWith('sb-') || c.includes('supabase'))
        
        setDebug({
          hasSession: !!data.session,
          userId: data.session?.user?.id || null,
          cookies: cookies,
          timestamp: new Date().toISOString()
        })
      } catch (error) {
        console.error('Auth debug error:', error)
      }
    }
    
    checkAuth()
    
    // Refresh every 5 seconds
    const interval = setInterval(checkAuth, 5000)
    return () => clearInterval(interval)
  }, [])
  
  return (
    <div className="mt-4 p-4 bg-gray-100 rounded text-xs">
      <h3 className="font-medium">Auth Debug</h3>
      <div>Last Checked: {debug.timestamp}</div>
      <div>Has Session: {debug.hasSession ? 'Yes' : 'No'}</div>
      <div>User ID: {debug.userId || 'None'}</div>
      <div>Auth Cookies: {debug.cookies.length}</div>
      {debug.cookies.map((cookie, i) => (
        <div key={i} className="truncate">{cookie}</div>
      ))}
      <div className="flex gap-2 mt-2">
        <button 
          className="text-blue-500 underline text-xs"
          onClick={() => window.location.reload()}
        >
          Refresh Page
        </button>
        <button 
          className="text-blue-500 underline text-xs"
          onClick={() => {
            document.cookie.split(';').forEach(c => {
              const name = c.split('=')[0].trim()
              if (name.startsWith('sb-') || name.includes('supabase')) {
                document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;`
              }
            })
            window.location.reload()
          }}
        >
          Clear Auth Cookies
        </button>
      </div>
    </div>
  )
}