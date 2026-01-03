// src/app/(dashboard)/dashboard/progress/page.tsx
"use client";

import dynamic from "next/dynamic";
import { Button } from "@/shared/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useLottieAnimation } from "@/shared/hooks/use-lottie-animation";

// Dynamically import Lottie to avoid SSR issues
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

export default function ProgressPage() {
  const { animationData } = useLottieAnimation("under_construction");

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="max-w-2xl mx-auto text-center space-y-8">
        {/* Lottie Animation */}
        {animationData && (
          <div className="w-full max-w-[150px] mx-auto">
            <Lottie
              animationData={animationData}
              loop={true}
              style={{ width: "100%", height: "auto" }}
              speed={0.1}
            />
          </div>
        )}

        {/* Title */}
        <div className="space-y-3">
          <h1 className="text-4xl font-bold tracking-tight">Progress Tracking</h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Structured learning paths are being built to guide your pathology education journey.
            Soon you'll be able to track your learning milestones, maintain study streaks, monitor
            module completion rates, and celebrate your achievements.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col items-center justify-center gap-3 pt-4">
          <Link
            href="https://discord.gg/2v64p2fzsC"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full max-w-xs"
          >
            <Button
              size="lg"
              className="bg-[#5865F2] hover:bg-[#4752C4] text-white px-12 py-6 text-lg w-full
                transform hover:scale-105 active:scale-95
                hover:shadow-xl hover:shadow-[#5865F2]/20
                transition-all duration-300 ease-in-out
                relative overflow-hidden flex items-center justify-center gap-2"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
              Join Our Discord
            </Button>
          </Link>

          <Link href="/dashboard" className="w-full max-w-xs">
            <Button
              size="lg"
              variant="ghost"
              className="flex items-center justify-center gap-2 py-6 text-lg w-full"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
