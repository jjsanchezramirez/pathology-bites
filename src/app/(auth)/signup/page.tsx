// src/app/(auth)/signup/page.tsx
import { Metadata } from "next";
import { generateMetadata } from "@/shared/utils/seo";
import { SignupForm } from "@/features/auth/components/forms/signup-form";
import { AuthPageLayout } from "@/features/auth/components/ui/auth-page-layout";

export const metadata: Metadata = generateMetadata({
  title: "Sign Up",
  description:
    "Create a free Pathology Bites account to access practice questions, quizzes, and study materials.",
  url: "/signup",
});

export default function SignupPage() {
  // Note: Authentication check moved to client-side to avoid cookies() during build
  // The SignupForm component will handle redirecting authenticated users

  return (
    <AuthPageLayout maxWidth="md">
      <SignupForm />
    </AuthPageLayout>
  );
}
