// src/app/debug-auth/page.tsx
import { createClient } from '@/lib/supabase/server'
import { SessionDebugComponent } from '@/components/debug/session-debug'

export default async function DebugAuthPage() {
  // Server-side auth check
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  // Also check session
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()

  return (
    <div className="container mx-auto p-8 max-w-6xl">
      <h1 className="text-2xl font-bold mb-8">Authentication Debug</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Server-Side Check */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Server-Side Auth Check</h2>
          <div className="bg-gray-50 p-6 rounded-lg">
            <h3 className="font-medium mb-2">getUser() result:</h3>
            <pre className="bg-white p-4 rounded border text-sm overflow-auto mb-4">
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

            <h3 className="font-medium mb-2">getSession() result:</h3>
            <pre className="bg-white p-4 rounded border text-sm overflow-auto">
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
        </div>

        {/* Client-Side Check */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Client-Side Debug</h2>
          <SessionDebugComponent />
        </div>
      </div>

      {/* Environment Check */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Environment Check</h2>
        <div className="bg-gray-50 p-6 rounded-lg">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <strong>NEXT_PUBLIC_SITE_URL:</strong> {process.env.NEXT_PUBLIC_SITE_URL || 'Not set'}
            </div>
            <div>
              <strong>NEXT_PUBLIC_SUPABASE_URL:</strong> {process.env.NEXT_PUBLIC_SUPABASE_URL || 'Not set'}
            </div>
            <div>
              <strong>NODE_ENV:</strong> {process.env.NODE_ENV}
            </div>
            <div>
              <strong>Anon Key Present:</strong> {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Yes' : 'No'}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Navigation */}
      <div className="mt-8 flex flex-wrap gap-4">
        <a href="/login" className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
          Go to Login
        </a>
        <a href="/dashboard" className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
          Go to Dashboard
        </a>
        <a href="/admin/dashboard" className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600">
          Go to Admin Dashboard
        </a>
      </div>
    </div>
  )
}