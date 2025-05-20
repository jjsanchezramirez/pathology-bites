// src/app/debug/auth/page.tsx
"use client"

import AuthFlowVisualizer from '@/components/auth/auth-flow-visualizer'

export default function AuthDebugPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Authentication Debug</h1>
      <AuthFlowVisualizer />
    </div>
  )
}