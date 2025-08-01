"use client"

import { ToastTest } from "@/shared/components/common/toast-test"
import { Button } from "@/shared/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { ArrowLeft, MessageSquare } from "lucide-react"

export default function ToastDebugPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Navigation */}
        <div className="mb-6">
          <Button variant="outline" asChild>
            <a href="/debug" className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Debug Index
            </a>
          </Button>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-4 flex items-center justify-center gap-2">
            <MessageSquare className="w-8 h-8 text-blue-600" />
            Toast Debug Page
          </h1>
          <p className="text-gray-600">
            Use this page to test and debug Sonner toast functionality
          </p>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Toast Test Controls</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <ToastTest />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Debug Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <p><strong>Sonner Version:</strong> 2.0.3</p>
                <p><strong>React Version:</strong> 19.1.0</p>
                <p><strong>Next.js Version:</strong> 15.3.2</p>
              </div>
              <div className="space-y-2">
                <p><strong>Expected Behavior:</strong> Toasts should appear immediately and be visible without hovering</p>
                <p><strong>Position:</strong> Bottom-right</p>
                <p><strong>Theme:</strong> Follows system theme</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
