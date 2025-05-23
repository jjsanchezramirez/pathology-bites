// src/app/(auth)/login/page.tsx
import { Suspense } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { login } from '@/lib/auth/actions'
import { AuthPageLayout } from '@/components/auth/ui/auth-page-layout'
import { AuthCard } from '@/components/auth/ui/auth-card'
import { FormField } from '@/components/auth/ui/form-field'
import { FormButton } from '@/components/auth/ui/form-button'
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button'
import { AuthDivider } from '@/components/auth/ui/auth-divider'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface LoginPageProps {
  searchParams: Promise<{ error?: string; message?: string; redirect?: string }>
}

async function LoginForm({ searchParams }: LoginPageProps) {
  // Await searchParams for Next.js 15
  const params = await searchParams
  
  // Check if user is already authenticated
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (user) {
    const redirectPath = params.redirect || '/dashboard'
    redirect(redirectPath)
  }

  return (
    <AuthCard
      title="Welcome back"
      description="Login with Google or your email account"
      showPrivacyFooter
    >
      {params.error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{params.error}</AlertDescription>
        </Alert>
      )}
      
      {params.message && (
        <Alert className="mb-4">
          <AlertDescription>{params.message}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-6">
        <GoogleSignInButton />
        
        <AuthDivider text="Or continue with" />
        
        <form action={login} className="space-y-4">
          <input type="hidden" name="redirect" value={params.redirect || ''} />
          
          <FormField
            id="email"
            name="email"
            label="Email"
            type="email"
            placeholder="name@example.com"
            autoComplete="email"
            required
          />
          
          <FormField
            id="password"
            name="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            rightElement={
              <Link
                href="/forgot-password"
                className="text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
              >
                Forgot?
              </Link>
            }
          />
          
          <FormButton type="submit" fullWidth>
            Login
          </FormButton>
        </form>
        
        <div className="text-center text-sm text-muted-foreground">
          Don't have an account?{" "}
          <Link 
            href="/signup" 
            className="text-foreground underline underline-offset-4 hover:text-primary"
          >
            Sign up
          </Link>
        </div>
      </div>
    </AuthCard>
  )
}

export default function LoginPage(props: LoginPageProps) {
  return (
    <AuthPageLayout maxWidth="sm">
      <Suspense fallback={<div>Loading...</div>}>
        <LoginForm {...props} />
      </Suspense>
    </AuthPageLayout>
  )
}