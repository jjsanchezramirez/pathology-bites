import { createClient } from '@/shared/services/server'
import { SessionDebugComponent } from '@/shared/components/common/session-debug'
import { Button } from "@/shared/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { ArrowLeft, User, Shield, Database, Server } from "lucide-react"

export default async function DebugAuthPage() {
  // Server-side auth check
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  // Also check session
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
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
            <Shield className="w-8 h-8 text-blue-600" />
            Authentication Debug
          </h1>
          <p className="text-gray-600">Server-side and client-side authentication status</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Server-Side Check */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="w-5 h-5" />
                Server-Side Auth Check
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-medium mb-2">getUser() result:</h3>
                <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                  {JSON.stringify({
                    user: user ? {
                      id: user.id,
                      email: user.email,
                      confirmed: user.email_confirmed_at ? true : false,
                      created: user.created_at
                    } : null,
                    error: error?.message || null
                  }, null, 2)}
                </pre>
              </div>

              <div>
                <h3 className="font-medium mb-2">getSession() result:</h3>
                <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                  {JSON.stringify({
                    session: session ? {
                      user: session.user?.email,
                      expires_at: session.expires_at,
                      provider_token: !!session.provider_token,
                      access_token: session.access_token ? 'EXISTS' : null,
                      refresh_token: session.refresh_token ? 'EXISTS' : null
                    } : null,
                    error: sessionError?.message || null
                  }, null, 2)}
                </pre>
              </div>
            </CardContent>
          </Card>

          {/* Client-Side Check */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Client-Side Debug
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SessionDebugComponent />
            </CardContent>
          </Card>
        </div>

        {/* Environment Check */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Environment Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <p className="font-medium">NEXT_PUBLIC_SITE_URL:</p>
                <p className="text-gray-600 font-mono">{process.env.NEXT_PUBLIC_SITE_URL || 'Not set'}</p>
              </div>
              <div className="space-y-1">
                <p className="font-medium">NEXT_PUBLIC_SUPABASE_URL:</p>
                <p className="text-gray-600 font-mono">{process.env.NEXT_PUBLIC_SUPABASE_URL || 'Not set'}</p>
              </div>
              <div className="space-y-1">
                <p className="font-medium">NODE_ENV:</p>
                <p className="text-gray-600 font-mono">{process.env.NODE_ENV}</p>
              </div>
              <div className="space-y-1">
                <p className="font-medium">Anon Key Present:</p>
                <p className="text-gray-600 font-mono">{process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Yes' : 'No'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Navigation */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Quick Navigation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <Button asChild>
                <a href="/login">Go to Login</a>
              </Button>
              <Button asChild variant="outline">
                <a href="/dashboard">Go to Dashboard</a>
              </Button>
              <Button asChild variant="outline">
                <a href="/admin/dashboard">Go to Admin Dashboard</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}