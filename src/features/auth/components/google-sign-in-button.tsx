// src/components/auth/google-sign-in-button.tsx
"use client";

import { createClient } from "@/shared/services/client";
import { SocialButton } from "@/features/auth/components/ui/social-button";
import { toast } from "@/shared/utils/toast";

export function GoogleSignInButton() {
  // Feature flags removed - always allow Google sign-in

  const handleGoogleSignIn = async () => {
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });

    if (error) {
      console.error("Google sign-in error:", error);
      toast.error("Failed to sign in with Google. Please try again.");
    }
  };

  return <SocialButton provider="google" onClick={handleGoogleSignIn} />;
}
