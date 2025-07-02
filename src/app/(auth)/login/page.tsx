// src/app/(auth)/login/page.tsx
import { Suspense } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/shared/services/server'
import { login } from '@/features/auth/services/actions'
import { AuthPageLayout } from '@/features/auth/components/ui/auth-page-layout'
import { AuthCard } from '@/features/auth/components/ui/auth-card'
import { FormField } from '@/features/auth/components/ui/form-field'
import { FormButton } from '@/features/auth/components/ui/form-button'
import { GoogleSignInButton } from '@/features/auth/components/google-sign-in-button'
import { AuthDivider } from '@/features/auth/components/ui/auth-divider'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'
import { CSRFForm } from '@/features/auth/components/ui/csrf-form'
import { LoadingSpinner } from '@/shared/components/common/loading-spinner'

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

  // Check if coming soon mode is enabled
  const isComingSoonMode = process.env.NEXT_PUBLIC_COMING_SOON_MODE === 'true'

  return (
    <AuthCard
      title={isComingSoonMode ? "Admin Login" : "Welcome back"}
      description={isComingSoonMode ? "Admin access to Pathology Bites" : "Login with Google or your email account"}
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
        
        <CSRFForm action={login} className="space-y-4">
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
        </CSRFForm>

        {!isComingSoonMode && (
          <div className="text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link
              href="/signup"
              className="text-foreground underline underline-offset-4 hover:text-primary"
            >
              Sign up
            </Link>
          </div>
        )}
      </div>
    </AuthCard>
  )
}

// Loading component that matches the site's style
function LoginPageLoading() {
  // Check if coming soon mode is enabled
  const isComingSoonMode = process.env.NEXT_PUBLIC_COMING_SOON_MODE === 'true'

  return (
    <AuthCard
      title={isComingSoonMode ? "Admin Login" : "Welcome back"}
      description={isComingSoonMode ? "Admin access to Pathology Bites" : "Login with Google or your email account"}
      showPrivacyFooter
    >
      <div className="py-8">
        <LoadingSpinner size="lg" text="Loading login form..." />
      </div>
    </AuthCard>
  )
}

export default function LoginPage(props: LoginPageProps) {
  return (
    <AuthPageLayout maxWidth="sm">
      <Suspense fallback={<LoginPageLoading />}>
        <LoginForm {...props} />
      </Suspense>
    </AuthPageLayout>
  )
}