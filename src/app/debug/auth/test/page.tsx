"use client"

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { User, Session, AuthError, Provider } from '@supabase/supabase-js'

// Define type for different Supabase responses
interface SupabaseAuthResult {
  data: {
    user: User | null;
    session: Session | null;
  } | null;
  error: AuthError | null;
}

// Update the password reset type to match actual Supabase response structure
interface PasswordResetResult {
  data: Record<string, never> | null; // Empty object or null
  error: AuthError | null;
}

// Update OAuth result to match Supabase's actual return type
interface OAuthResult {
  data: { 
    provider: Provider; 
    url: string | null;
  } | null;
  error: AuthError | null;
}

export default function AuthTestPage() {
  const [signupResult, setSignupResult] = useState<SupabaseAuthResult | null>(null)
  const [signinResult, setSigninResult] = useState<SupabaseAuthResult | null>(null)
  const [passwordResult, setPasswordResult] = useState<PasswordResetResult | null>(null)
  const [oauthResult, setOauthResult] = useState<OAuthResult | null>(null)
  const [loading, setLoading] = useState(false)
  
  // Signup test
  const testSignup = async (email: string, password: string) => {
    setLoading(true)
    setSignupResult(null)
    
    try {
      const supabase = createClient()
      
      const result = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/api/auth/callback`,
          data: {
            first_name: 'Test',
            last_name: 'User',
          }
        }
      })
      
      setSignupResult(result)
      
      if (email && !result.error) {
        localStorage.setItem('pendingVerificationEmail', email)
      }
    } catch (err) {
      console.error("Error during signup test:", err)
      setSignupResult({ 
        data: null,
        error: err instanceof Error ? err as AuthError : new Error('Unknown error occurred') as AuthError 
      })
    } finally {
      setLoading(false)
    }
  }
  
  // Signin test
  const testSignin = async (email: string, password: string) => {
    setLoading(true)
    setSigninResult(null)
    
    try {
      const supabase = createClient()
      
      const result = await supabase.auth.signInWithPassword({
        email,
        password
      })
      
      setSigninResult(result)
    } catch (err) {
      console.error("Error during signin test:", err)
      setSigninResult({ 
        data: null,
        error: err instanceof Error ? err as AuthError : new Error('Unknown error occurred') as AuthError 
      })
    } finally {
      setLoading(false)
    }
  }
  
  // Password reset test
  const testPasswordReset = async (email: string) => {
    setLoading(true)
    setPasswordResult(null)
    
    try {
      const supabase = createClient()
      
      const result = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/api/auth/callback`
      })
      
      // The result will be in the form { data: {}, error: null }
      setPasswordResult(result as PasswordResetResult)
    } catch (err) {
      console.error("Error during password reset test:", err)
      setPasswordResult({ 
        data: null,
        error: err instanceof Error ? err as AuthError : new Error('Unknown error occurred') as AuthError 
      })
    } finally {
      setLoading(false)
    }
  }
  
  // OAuth test (Google)
  const testOAuth = async () => {
    setLoading(true)
    setOauthResult(null)
    
    try {
      const supabase = createClient()
      
      const result = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback`
        }
      })
      
      // Use type assertion to match our interface
      setOauthResult(result as unknown as OAuthResult)
    } catch (err) {
      console.error("Error during OAuth test:", err)
      setOauthResult({ 
        data: null,
        error: err instanceof Error ? err as AuthError : new Error('Unknown error occurred') as AuthError 
      })
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Auth Testing Tool</h1>
      
      <Tabs defaultValue="signup">
        <TabsList className="mb-4">
          <TabsTrigger value="signup">Sign Up</TabsTrigger>
          <TabsTrigger value="signin">Sign In</TabsTrigger>
          <TabsTrigger value="password">Password Reset</TabsTrigger>
          <TabsTrigger value="oauth">OAuth</TabsTrigger>
        </TabsList>
        
        <TabsContent value="signup">
          <Card>
            <CardHeader>
              <CardTitle>Sign Up Test</CardTitle>
              <CardDescription>Test Supabase signUp functionality</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input 
                    id="signup-email" 
                    placeholder="test@example.com" 
                    disabled={loading}
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input 
                    id="signup-password" 
                    type="password" 
                    placeholder="••••••••" 
                    disabled={loading}
                  />
                </div>
                
                <Button 
                  onClick={() => {
                    const email = (document.getElementById('signup-email') as HTMLInputElement).value
                    const password = (document.getElementById('signup-password') as HTMLInputElement).value
                    testSignup(email, password)
                  }} 
                  disabled={loading}
                >
                  {loading ? 'Testing...' : 'Test Sign Up'}
                </Button>
                
                {signupResult && (
                  <div className="mt-4 p-4 border rounded-md bg-gray-50">
                    <h3 className="font-bold mb-2">Result:</h3>
                    <pre className="text-xs overflow-auto p-2 bg-gray-100 rounded">
                      {JSON.stringify(signupResult, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="signin">
          <Card>
            <CardHeader>
              <CardTitle>Sign In Test</CardTitle>
              <CardDescription>Test Supabase signInWithPassword functionality</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input 
                    id="signin-email" 
                    placeholder="test@example.com" 
                    disabled={loading}
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <Input 
                    id="signin-password" 
                    type="password" 
                    placeholder="••••••••" 
                    disabled={loading}
                  />
                </div>
                
                <Button 
                  onClick={() => {
                    const email = (document.getElementById('signin-email') as HTMLInputElement).value
                    const password = (document.getElementById('signin-password') as HTMLInputElement).value
                    testSignin(email, password)
                  }} 
                  disabled={loading}
                >
                  {loading ? 'Testing...' : 'Test Sign In'}
                </Button>
                
                {signinResult && (
                  <div className="mt-4 p-4 border rounded-md bg-gray-50">
                    <h3 className="font-bold mb-2">Result:</h3>
                    <pre className="text-xs overflow-auto p-2 bg-gray-100 rounded">
                      {JSON.stringify(signinResult, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="password">
          <Card>
            <CardHeader>
              <CardTitle>Password Reset Test</CardTitle>
              <CardDescription>Test Supabase resetPasswordForEmail functionality</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input 
                    id="reset-email" 
                    placeholder="test@example.com" 
                    disabled={loading}
                  />
                </div>
                
                <Button 
                  onClick={() => {
                    const email = (document.getElementById('reset-email') as HTMLInputElement).value
                    testPasswordReset(email)
                  }} 
                  disabled={loading}
                >
                  {loading ? 'Testing...' : 'Test Password Reset'}
                </Button>
                
                {passwordResult && (
                  <div className="mt-4 p-4 border rounded-md bg-gray-50">
                    <h3 className="font-bold mb-2">Result:</h3>
                    <pre className="text-xs overflow-auto p-2 bg-gray-100 rounded">
                      {JSON.stringify(passwordResult, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="oauth">
          <Card>
            <CardHeader>
              <CardTitle>OAuth Test</CardTitle>
              <CardDescription>Test Supabase signInWithOAuth functionality</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Button 
                  onClick={testOAuth} 
                  disabled={loading}
                >
                  {loading ? 'Testing...' : 'Test Google OAuth'}
                </Button>
                
                {oauthResult && (
                  <div className="mt-4 p-4 border rounded-md bg-gray-50">
                    <h3 className="font-bold mb-2">Result:</h3>
                    <pre className="text-xs overflow-auto p-2 bg-gray-100 rounded">
                      {JSON.stringify(oauthResult, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      <div className="mt-8">
        <h2 className="text-xl font-bold mb-4">Environment Info</h2>
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-2">
              <div className="flex justify-between">
                <span className="font-medium">Node Environment:</span>
                <span>{process.env.NODE_ENV}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Site URL:</span>
                <span>{process.env.NEXT_PUBLIC_SITE_URL || 'Not set'}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Supabase URL:</span>
                <span>{process.env.NEXT_PUBLIC_SUPABASE_URL ? '✓ Set' : '❌ Not set'}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Supabase Anon Key:</span>
                <span>{process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✓ Set' : '❌ Not set'}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Google Client ID:</span>
                <span>{process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ? '✓ Set' : '❌ Not set'}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Location:</span>
                <span>{typeof window !== 'undefined' ? window.location.origin : 'Server-side'}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}