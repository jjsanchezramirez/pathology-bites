// app/(auth)/forgot-password/page.tsx
import Link from 'next/link'
import { forgotPassword } from '@/lib/auth/actions'
import { AuthPageLayout } from '@/components/auth/ui/auth-page-layout'
import { AuthCard } from '@/components/auth/ui/auth-card'
import { FormField } from '@/components/auth/ui/form-field'
import { FormButton } from '@/components/auth/ui/form-button'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface ForgotPasswordPageProps {
  searchParams: { error?: string }
}

export default function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  return (
    <AuthPageLayout maxWidth="sm">
      <AuthCard
        title="Reset your password"
        description="Enter your email and we'll send you a link to reset your password"
        footer={
          <Link href="/login" className="text-sm text-muted-foreground hover:text-primary">
            Back to login
          </Link>
        }
      >
        {searchParams.error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{searchParams.error}</AlertDescription>
          </Alert>
        )}

        <form action={forgotPassword} className="space-y-6">
          <FormField
            id="email"
            name="email"
            label="Email"
            type="email"
            placeholder="name@example.com"
            autoComplete="email"
            required
          />
          
          <FormButton type="submit" fullWidth>
            Send reset link
          </FormButton>
        </form>
      </AuthCard>
    </AuthPageLayout>
  )
}

// app/(auth)/reset-password/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resetPassword } from '@/lib/auth/actions'
import { AuthPageLayout } from '@/components/auth/ui/auth-page-layout'
import { AuthCard } from '@/components/auth/ui/auth-card'
import { FormField } from '@/components/auth/ui/form-field'
import { FormButton } from '@/components/auth/ui/form-button'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface ResetPasswordPageProps {
  searchParams: { error?: string }
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?error=Invalid or expired reset link')
  }

  return (
    <AuthPageLayout maxWidth="sm">
      <AuthCard
        title="Create new password"
        description="Enter a new strong password for your account"
      >
        {searchParams.error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{searchParams.error}</AlertDescription>
          </Alert>
        )}

        <form action={resetPassword} className="space-y-6">
          <FormField
            id="password"
            name="password"
            label="New Password"
            type="password"
            autoComplete="new-password"
            required
          />
          
          <div className="text-sm text-muted-foreground">
            <p>Password must:</p>
            <ul className="list-disc list-inside space-y-1 pl-4 mt-1">
              <li>Be at least 8 characters long</li>
              <li>Include at least one uppercase letter</li>
              <li>Include at least one lowercase letter</li>
              <li>Include at least one number</li>
            </ul>
          </div>
          
          <FormButton type="submit" fullWidth>
            Update Password
          </FormButton>
        </form>
      </AuthCard>
    </AuthPageLayout>
  )
}