// src/components/common/connection-status.tsx
"use client"

import { useNetworkStatus } from "@/hooks/use-network-status"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { WifiOff } from "lucide-react"

export function ConnectionStatus() {
  const isOnline = useNetworkStatus()
  
  if (isOnline) return null
  
  return (
    <Alert variant="destructive" className="fixed bottom-4 right-4 max-w-md z-50 animate-in slide-in-from-bottom-4">
      <WifiOff className="h-4 w-4 mr-2" />
      <AlertDescription>
        You are currently offline. Some features may not work properly.
      </AlertDescription>
    </Alert>
  )
}