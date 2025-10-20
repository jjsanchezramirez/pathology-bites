// src/app/(auth)/login/page.tsx
import { login } from '@/features/auth/services/actions'
import { AuthPageLayout } from '@/features/auth/components/ui/auth-page-layout'
import { AuthCard } from '@/features/auth/components/ui/auth-card'
import { LoginForm } from '@/features/auth/components/forms/login-form'

interface LoginPageProps {
  searchParams: Promise<{ redirect?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  // Await searchParams for Next.js 15
  const params = await searchParams

  // Note: Authentication check moved to client-side to avoid cookies() during build
  // The LoginForm component will handle redirecting authenticated users

  // Check if coming soon or maintenance mode is enabled
  const isComingSoonMode = process.env.NEXT_PUBLIC_COMING_SOON_MODE === 'true'
  const isMaintenanceMode = process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true'
  const isAdminOnlyMode = isComingSoonMode || isMaintenanceMode

  return (
    <AuthPageLayout maxWidth="sm">
      <AuthCard
        title={isAdminOnlyMode ? "Admin Login" : "Welcome back"}
        description={isAdminOnlyMode ? "Admin access to Pathology Bites" : "Login with Google or your email account"}
        showPrivacyFooter
      >
        <LoginForm
          action={login}
          redirect={params.redirect}
          isAdminOnlyMode={isAdminOnlyMode}
        />
      </AuthCard>
    </AuthPageLayout>
  )
}