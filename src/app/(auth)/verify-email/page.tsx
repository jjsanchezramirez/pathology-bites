// app/(auth)/verify-email/page.tsx
import { VerifyEmailForm } from '@/features/auth/components/forms/verify-email-form'
import { AuthPageLayout } from '@/features/auth/components/ui/auth-page-layout'

interface VerifyEmailPageProps {
  searchParams: Promise<{ email?: string; error?: string; message?: string }>
}

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const params = await searchParams
  const email = params.email

  return (
    <AuthPageLayout>
      <VerifyEmailForm
        email={email}
        initialError={params.error}
        initialMessage={params.message}
      />
    </AuthPageLayout>
  )
}