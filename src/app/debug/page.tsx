'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Button } from "@/shared/components/ui/button"
import { Badge } from "@/shared/components/ui/badge"
import {
  Bug,
  Settings,
  User,
  MessageSquare,
  TestTube,
  Eye,
  Home,
  Server,
  Database,
  Shield,
  Zap,
  RefreshCw
} from "lucide-react"
import { toast } from "sonner"

export default function DebugPage() {
  const clearCache = () => {
    // Clear various browser caches
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          caches.delete(name)
        })
      })
    }

    // Clear localStorage and sessionStorage
    localStorage.clear()
    sessionStorage.clear()

    // Force reload without cache
    window.location.reload()

    toast.success('Cache cleared! Page will reload...')
  }

  const debugTools = [
    {
      category: "Authentication & Users",
      icon: Shield,
      tools: [
        {
          name: "Auth Debug",
          href: "/debug/auth",
          icon: User,
          description: "View authentication status, user data, and session info"
        },
        {
          name: "User Role Debug",
          href: "/debug/user-role",
          icon: Shield,
          description: "Debug user roles, permissions, and metadata"
        }
      ]
    },
    {
      category: "UI Components",
      icon: TestTube,
      tools: [
        {
          name: "Toast Debug",
          href: "/debug/toast",
          icon: MessageSquare,
          description: "Test Sonner toast notifications and styling"
        },
        {
          name: "Demo Comparison",
          href: "/debug/demo-comparison",
          icon: TestTube,
          description: "Compare old vs new demo question components"
        }
      ]
    },
    {
      category: "System & Environment",
      icon: Server,
      tools: [
        {
          name: "Bypass Control",
          href: "/debug/bypass",
          icon: Eye,
          description: "Manage coming soon mode bypass settings"
        },
        {
          name: "Clear Cache",
          action: clearCache,
          icon: RefreshCw,
          description: "Clear browser cache and force reload (fixes cached JS issues)"
        }
      ]
    }
  ]

  const apiEndpoints = [
    {
      name: "Auth Debug API",
      href: "/api/debug/auth",
      description: "Authentication configuration and environment info"
    },
    {
      name: "Demo Questions API",
      href: "/api/debug/demo-questions",
      description: "Debug demo questions status and data"
    }
  ]

  const environmentInfo = {
    environment: process.env.NODE_ENV,
    comingSoonMode: process.env.NEXT_PUBLIC_COMING_SOON_MODE === 'true',
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) + '...',
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4 flex items-center justify-center gap-3">
            <Bug className="w-10 h-10 text-blue-600" />
            Debug Control Center
          </h1>
          <p className="text-gray-600 text-lg">
            Development tools and debugging utilities for Pathology Bites
          </p>
        </div>

        {/* Environment Info */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="w-5 h-5" />
              Environment Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-600">Environment</p>
                <Badge variant={environmentInfo.environment === 'development' ? 'default' : 'secondary'}>
                  {environmentInfo.environment?.toUpperCase()}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-600">Coming Soon Mode</p>
                <Badge variant={environmentInfo.comingSoonMode ? 'destructive' : 'secondary'}>
                  {environmentInfo.comingSoonMode ? 'ENABLED' : 'DISABLED'}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-600">Supabase URL</p>
                <p className="text-xs text-gray-500 font-mono">{environmentInfo.supabaseUrl}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-600">Site URL</p>
                <p className="text-xs text-gray-500 font-mono">{environmentInfo.siteUrl}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Debug Tools */}
        <div className="space-y-8">
          {debugTools.map((category) => (
            <Card key={category.category}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <category.icon className="w-5 h-5" />
                  {category.category}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {category.tools.map((tool) => {
                    const Component = tool.action ? 'button' : 'a'
                    const props = tool.action
                      ? { onClick: tool.action }
                      : { href: tool.href }

                    return (
                      <Component
                        key={tool.name}
                        {...props}
                        className="flex items-start gap-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors group text-left w-full"
                      >
                        <tool.icon className="w-5 h-5 text-blue-600 mt-0.5 group-hover:text-blue-700" />
                        <div className="flex-1">
                          <div className="font-medium group-hover:text-blue-700">{tool.name}</div>
                          <div className="text-sm text-gray-600 mt-1">{tool.description}</div>
                        </div>
                      </Component>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* API Endpoints */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Debug API Endpoints
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              {apiEndpoints.map((endpoint) => (
                <a
                  key={endpoint.name}
                  href={endpoint.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors group"
                >
                  <Zap className="w-5 h-5 text-green-600 mt-0.5 group-hover:text-green-700" />
                  <div className="flex-1">
                    <div className="font-medium group-hover:text-green-700">{endpoint.name}</div>
                    <div className="text-sm text-gray-600 mt-1">{endpoint.description}</div>
                    <div className="text-xs text-gray-500 font-mono mt-1">{endpoint.href}</div>
                  </div>
                </a>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Navigation */}
        <div className="mt-8 text-center">
          <Button asChild>
            <a href="/" className="flex items-center gap-2">
              <Home className="w-4 h-4" />
              Back to Home
            </a>
          </Button>
        </div>
      </div>
    </div>
  )
}