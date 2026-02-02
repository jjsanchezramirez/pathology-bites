// src/app/(public)/maintenance/page.tsx
"use client";

import dynamic from "next/dynamic";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { useMaintenanceNotifications } from "@/shared/hooks/use-maintenance-notifications";
import { toast } from "@/shared/utils/ui/toast";
import { useLottieAnimation } from "@/shared/hooks/use-lottie-animation";
import Link from "next/link";

// Dynamically import Lottie to avoid SSR issues
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

export default function MaintenancePage() {
  const { animationData } = useLottieAnimation("under_construction");

  const { email, setEmail, isSubmitting, handleSubmit } = useMaintenanceNotifications({
    onSuccess: () => {
      toast.success("Thanks! We'll notify you when we're back online.");
      setEmail("");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to subscribe. Please try again later."
      );
    },
  });

  return (
    <main className="relative flex flex-col min-h-screen">
      {/* Background Gradients - Similar to landing page */}
      <div className="absolute inset-0 bg-linear-to-b from-primary/5 via-transparent to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(56,189,248,0.12),transparent_25%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(56,189,248,0.13),transparent_25%)]" />

      {/* Main Content */}
      <section className="relative flex-1 flex items-center justify-center overflow-hidden py-20 px-4">
        <div className="container mx-auto max-w-4xl z-10">
          <div className="text-center space-y-12">
            {/* Lottie Animation */}
            {animationData && (
              <div className="w-full max-w-[200px] mx-auto">
                <Lottie
                  animationData={animationData}
                  loop={true}
                  style={{ width: "100%", height: "auto" }}
                />
              </div>
            )}

            {/* Title */}
            <div className="space-y-4">
              <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold">
                We're currently{" "}
                <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                  upgrading our site
                </span>
              </h1>

              <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                We're performing scheduled maintenance to improve your experience. Get notified when
                we're back online.
              </p>
            </div>

            {/* Subscription Form */}
            <div className="max-w-md mx-auto">
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="flex items-center rounded-full bg-background p-2 pl-4 shadow-sm border border-border">
                  <span className="sr-only">
                    <Label htmlFor="email-input">Email address</Label>
                  </span>
                  <svg
                    className="w-5 h-5 text-muted-foreground mr-2 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                  <Input
                    id="email-input"
                    type="email"
                    placeholder="email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-sm flex-1"
                    aria-label="Email address"
                  />
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-full px-6 bg-primary hover:bg-primary/90"
                    aria-label="Subscribe for maintenance notification"
                  >
                    {isSubmitting ? "..." : "Notify Me"}
                  </Button>
                </div>
              </form>
            </div>

            {/* Additional CTA */}
            <div className="space-y-4 pt-4">
              <p className="text-lg text-muted-foreground">
                We'll be back soon! In the meantime, join our community:
              </p>

              {/* Discord Button */}
              <div className="flex justify-center">
                <Link
                  href="https://discord.gg/2v64p2fzsC"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block"
                >
                  <Button
                    size="lg"
                    className="bg-[#5865F2] hover:bg-[#4752C4] text-white px-8 py-6 text-lg
                      transform hover:scale-105 active:scale-95
                      hover:shadow-xl hover:shadow-[#5865F2]/20
                      transition-all duration-300 ease-in-out
                      relative overflow-hidden flex items-center gap-2"
                    aria-label="Join our Discord community"
                  >
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                    </svg>
                    Join Our Discord
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
