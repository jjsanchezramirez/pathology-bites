// src/app/(auth)/login/page.tsx
import { Suspense } from 'react'
import { login } from '@/features/auth/services/actions'
import { AuthPageLayout } from '@/features/auth/components/ui/auth-page-layout'
import { AuthCard } from '@/features/auth/components/ui/auth-card'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'
import { LoadingSpinner } from '@/shared/components/common/loading-spinner'
import { LoginForm } from '@/features/auth/components/forms/login-form'

interface LoginPageProps {
  searchParams: Promise<{ error?: string; message?: string; redirect?: string }>
}

async function LoginPageContent({ searchParams }: LoginPageProps) {
  // Await searchParams for Next.js 15
  const params = await searchParams

  // Note: Authentication check moved to client-side to avoid cookies() during build
  // The LoginForm component will handle redirecting authenticated users

  // Check if coming soon or maintenance mode is enabled
  const isComingSoonMode = process.env.NEXT_PUBLIC_COMING_SOON_MODE === 'true'
  const isMaintenanceMode = process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true'
  const isAdminOnlyMode = isComingSoonMode || isMaintenanceMode

  return (
    <AuthCard
      title={isAdminOnlyMode ? "Admin Login" : "Welcome back"}
      description={isAdminOnlyMode ? "Admin access to Pathology Bites" : "Login with Google or your email account"}
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

      <LoginForm
        action={login}
        redirect={params.redirect}
        isAdminOnlyMode={isAdminOnlyMode}
      />
    </AuthCard>
  )
}

// Loading component that matches the site's style
function LoginPageLoading() {
  // Check if coming soon or maintenance mode is enabled
  const isComingSoonMode = process.env.NEXT_PUBLIC_COMING_SOON_MODE === 'true'
  const isMaintenanceMode = process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true'
  const isAdminOnlyMode = isComingSoonMode || isMaintenanceMode

  return (
    <AuthCard
      title={isAdminOnlyMode ? "Admin Login" : "Welcome back"}
      description={isAdminOnlyMode ? "Admin access to Pathology Bites" : "Login with Google or your email account"}
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
        <LoginPageContent {...props} />
      </Suspense>
    </AuthPageLayout>
  )
}