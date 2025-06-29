"use client"

import { ToastTest } from "@/shared/components/common/toast-test"

export default function ToastDebugPage() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">Toast Debug Page</h1>
          <p className="text-muted-foreground">
            Use this page to test and debug Sonner toast functionality
          </p>
        </div>
        
        <div className="flex justify-center">
          <ToastTest />
        </div>
        
        <div className="bg-muted/50 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Debug Information</h2>
          <div className="space-y-2 text-sm">
            <p><strong>Sonner Version:</strong> 2.0.3</p>
            <p><strong>React Version:</strong> 19.1.0</p>
            <p><strong>Next.js Version:</strong> 15.3.2</p>
            <p><strong>Expected Behavior:</strong> Toasts should appear immediately and be visible without hovering</p>
            <p><strong>Position:</strong> Bottom-right</p>
            <p><strong>Theme:</strong> Follows system theme</p>
          </div>
        </div>
      </div>
    </div>
  )
}
