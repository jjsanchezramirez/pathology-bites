// src/app/(auth)/login/page.tsx
import { Metadata } from "next";
import { generateMetadata } from "@/shared/utils/seo";
import { login } from "@/features/auth/services/actions";
import { AuthPageLayout } from "@/features/auth/components/ui/auth-page-layout";
import { AuthCard } from "@/features/auth/components/ui/auth-card";
import { LoginForm } from "@/features/auth/components/forms/login-form";

export const metadata: Metadata = generateMetadata({
  title: "Log In",
  description:
    "Log in to Pathology Bites to access practice questions, quizzes, and study materials.",
  url: "/login",
});

interface LoginPageProps {
  searchParams: Promise<{
    redirect?: string;
    error?: string;
    message?: string;
  }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  // Await searchParams for Next.js 15
  const params = await searchParams;

  // Note: Authentication check moved to client-side to avoid cookies() during build
  // The LoginForm component will handle redirecting authenticated users

  return (
    <AuthPageLayout maxWidth="sm">
      <AuthCard
        title="Welcome back"
        description="Login with Google or your email account"
        showPrivacyFooter
      >
        <LoginForm
          action={login}
          redirect={params.redirect}
          initialError={params.error}
          initialMessage={params.message}
        />
      </AuthCard>
    </AuthPageLayout>
  );
}
