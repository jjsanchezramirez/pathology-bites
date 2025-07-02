'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/shared/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Badge } from "@/shared/components/ui/badge"
import { Settings, Eye, EyeOff, Home, TestTube, Users, BarChart3 } from "lucide-react"

export default function BypassPage() {
  const [bypassEnabled, setBypassEnabled] = useState(false)
  const [comingSoonMode, setComingSoonMode] = useState(false)

  useEffect(() => {
    // Check current bypass status
    const storedBypass = localStorage.getItem('pathology-bites-bypass')
    setBypassEnabled(storedBypass === 'true')
    
    // Check if coming soon mode is enabled
    setComingSoonMode(process.env.NEXT_PUBLIC_COMING_SOON_MODE === 'true')
  }, [])

  const enableBypass = () => {
    localStorage.setItem('pathology-bites-bypass', 'true')
    setBypassEnabled(true)
  }

  const disableBypass = () => {
    localStorage.removeItem('pathology-bites-bypass')
    setBypassEnabled(false)
  }

  const quickLinks = [
    { name: 'Home', href: '/', icon: Home, description: 'Main landing page' },
    { name: 'Demo Comparison', href: '/demo-comparison', icon: TestTube, description: 'Compare old vs new demo components' },
    { name: 'Admin Dashboard', href: '/admin/dashboard', icon: BarChart3, description: 'Admin dashboard (requires login)' },
    { name: 'User Dashboard', href: '/dashboard', icon: Users, description: 'User dashboard (requires login)' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-4 flex items-center justify-center gap-2">
            <Settings className="w-8 h-8" />
            Bypass Control Panel
          </h1>
          <p className="text-gray-600">Manage coming soon mode bypass settings</p>
        </div>

        {/* Status Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Current Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span>Coming Soon Mode:</span>
              <Badge variant={comingSoonMode ? "destructive" : "secondary"}>
                {comingSoonMode ? "ENABLED" : "DISABLED"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Bypass Status:</span>
              <Badge variant={bypassEnabled ? "default" : "outline"}>
                {bypassEnabled ? "ACTIVE" : "INACTIVE"}
              </Badge>
            </div>
            {comingSoonMode && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-blue-800 text-sm">
                  <strong>Coming Soon Mode is enabled.</strong> 
                  {bypassEnabled 
                    ? " You have bypass access to all features." 
                    : " Enable bypass below to access all features."
                  }
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bypass Controls */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Bypass Controls
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Button 
                onClick={enableBypass}
                disabled={bypassEnabled}
                className="flex-1"
              >
                <Eye className="w-4 h-4 mr-2" />
                Enable Bypass
              </Button>
              <Button 
                onClick={disableBypass}
                disabled={!bypassEnabled}
                variant="outline"
                className="flex-1"
              >
                <EyeOff className="w-4 h-4 mr-2" />
                Disable Bypass
              </Button>
            </div>
            
            <div className="text-sm text-gray-600 space-y-2">
              <p><strong>How it works:</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Enable bypass to access all features when coming soon mode is on</li>
                <li>Bypass setting is saved in your browser's local storage</li>
                <li>You can also enable bypass by visiting: <code className="bg-gray-100 px-1 rounded">/?bypass=true</code></li>
                <li>Bypass only affects your browser - other users still see coming soon page</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Quick Links */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Quick Access Links</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              {quickLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  className="flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <link.icon className="w-5 h-5 text-blue-600" />
                  <div>
                    <div className="font-medium">{link.name}</div>
                    <div className="text-sm text-gray-600">{link.description}</div>
                  </div>
                </a>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Access Methods</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div>
                <h4 className="font-medium">Method 1: URL Parameter</h4>
                <p className="text-sm text-gray-600">Add <code className="bg-gray-100 px-1 rounded">?bypass=true</code> to any URL</p>
                <code className="text-xs bg-gray-100 p-2 rounded block mt-1">
                  http://localhost:3000/?bypass=true
                </code>
              </div>
              
              <div>
                <h4 className="font-medium">Method 2: Direct Access</h4>
                <p className="text-sm text-gray-600">Visit this bypass page directly</p>
                <code className="text-xs bg-gray-100 p-2 rounded block mt-1">
                  http://localhost:3000/bypass
                </code>
              </div>
              
              <div>
                <h4 className="font-medium">Method 3: Persistent Bypass</h4>
                <p className="text-sm text-gray-600">Use the controls above to enable/disable bypass permanently</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Back to Home */}
        <div className="mt-8 text-center">
          <Button asChild>
            <a href="/">
              <Home className="w-4 h-4 mr-2" />
              Back to Home
            </a>
          </Button>
        </div>
      </div>
    </div>
  )
}
