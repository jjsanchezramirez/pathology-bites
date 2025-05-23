// app/(auth)/verify-email/page.tsx
import Link from 'next/link'
import { resendVerification } from '@/lib/auth/actions'
import { AuthPageLayout } from '@/components/auth/ui/auth-page-layout'
import { StatusCard } from '@/components/auth/ui/status-card'
import { FormButton } from '@/components/auth/ui/form-button'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface VerifyEmailPageProps {
  searchParams: Promise<{ email?: string; error?: string; message?: string }>
}

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const params = await searchParams
  const email = params.email

  return (
    <AuthPageLayout>
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

      <StatusCard
        title="Check your email"
        description={
          <>
            We've sent a verification link to{" "}
            <span className="font-medium text-foreground">
              {email || "your email address"}
            </span>
          </>
        }
        content="Please check your email and click the verification link to activate your account. If you don't see the email, check your spam folder."
        footer={
          <div className="flex flex-col gap-4 w-full">
            {email && (
              <form action={resendVerification.bind(null, email)}>
                <FormButton type="submit" fullWidth>
                  Resend verification email
                </FormButton>
              </form>
            )}
            <Button variant="outline" className="w-full" asChild>
              <Link href="/login">Back to login</Link>
            </Button>
          </div>
        }
      />
    </AuthPageLayout>
  )
}