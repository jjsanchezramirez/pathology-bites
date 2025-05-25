// src/app/(auth)/forgot-password/page.tsx
import Link from 'next/link'
import { forgotPassword } from '@/lib/auth/actions'
import { AuthPageLayout } from '@/components/auth/ui/auth-page-layout'
import { AuthCard } from '@/components/auth/ui/auth-card'
// import { FormField } from '@/components/auth/ui/form-field' // REMOVE THIS LINE
import { FormButton } from '@/components/auth/ui/form-button'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface ForgotPasswordPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const { error } = await searchParams;
  
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
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form action={forgotPassword} className="space-y-6">
          <input
            id="email"
            name="email"
            type="email"
            placeholder="name@example.com"
            autoComplete="email"
            required
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
          
          <FormButton type="submit" fullWidth>
            Send reset link
          </FormButton>
        </form>
      </AuthCard>
    </AuthPageLayout>
  )
}