// src/components/landing/demo-question-error.tsx
"use client";

import { RefreshCcw } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import dynamic from "next/dynamic";
import { useLottieAnimation } from "@/shared/hooks/use-lottie-animation";

// Dynamically import Lottie to avoid SSR issues
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

interface DemoQuestionErrorProps {
  message: string;
  onRetry: () => void;
}

export default function DemoQuestionError({ message, onRetry }: DemoQuestionErrorProps) {
  const { animationData, isLoading } = useLottieAnimation("error");

  return (
    <div
      className="w-full max-w-4xl mx-auto min-h-[400px] flex items-center justify-center relative overflow-hidden rounded-lg border bg-card"
      role="alert"
      aria-live="assertive"
    >
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(239,68,68,0.05),transparent_50%)]" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center space-y-4 px-6 py-8">
        {/* Lottie animation */}
        <div className="w-24 h-24 flex items-center justify-center">
          {isLoading || !animationData ? (
            <div className="w-full h-full bg-muted/20 rounded-full animate-pulse" />
          ) : (
            <Lottie
              animationData={animationData}
              loop={false}
              autoplay={true}
              style={{ width: "100%", height: "100%" }}
            />
          )}
        </div>

        {/* Error message */}
        <div className="space-y-1.5 max-w-md">
          <h3 className="text-xl font-semibold text-foreground">Unable to Load Question</h3>
          <p className="text-sm text-muted-foreground">
            {message || "We encountered an issue loading the demo question."}
          </p>
        </div>

        {/* Try again button */}
        <Button onClick={onRetry} variant="default" size="default" className="mt-2 gap-2">
          <RefreshCcw className="w-4 h-4" />
          Try Again
        </Button>
      </div>
    </div>
  );
}
