'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function DebugLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  
  useEffect(() => {
    // Block debug pages in production
    if (process.env.NODE_ENV === 'production') {
      router.replace('/not-found')
    }
  }, [router])

  // Don't render anything in production while redirecting
  if (process.env.NODE_ENV === 'production') {
    return null
  }

  return <>{children}</>
}
