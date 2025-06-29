// src/app/(auth)/forgot-password/page.tsx
import { ForgotPasswordForm } from '@/features/auth/components/forms/forgot-password-form'
import { AuthPageLayout } from '@/features/auth/components/ui/auth-page-layout'

interface ForgotPasswordPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const { error } = await searchParams;
  
  return (
    <AuthPageLayout maxWidth="sm">
      <ForgotPasswordForm initialError={error} />
    </AuthPageLayout>
  )
}