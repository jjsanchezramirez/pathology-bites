// src/shared/components/common/page-error.tsx
"use client";

import dynamic from "next/dynamic";
import { Button } from "@/shared/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useLottieAnimation } from "@/shared/hooks/use-lottie-animation";

// Dynamically import Lottie to avoid SSR issues
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

interface PageErrorProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export function PageError({
  title = "Something went wrong",
  description = "Please try refreshing the page",
  onRetry,
}: PageErrorProps) {
  const { animationData, isLoading } = useLottieAnimation("access_denied");

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      // Default: reload the page
      if (typeof window !== "undefined") {
        window.location.reload();
      }
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="max-w-2xl mx-auto text-center space-y-8">
        {/* Lottie Animation - only show if available */}
        {animationData && (
          <div className="w-full max-w-[150px] mx-auto">
            <Lottie
              animationData={animationData}
              loop={true}
              style={{ width: "100%", height: "auto" }}
            />
          </div>
        )}

        {/* Title */}
        <div className="space-y-3">
          <h1 className="text-4xl font-bold tracking-tight">{title}</h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            {description}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col items-center justify-center gap-3 pt-4">
          <Button
            size="lg"
            onClick={handleRetry}
            className="px-12 py-6 text-lg w-full max-w-xs
              transform hover:scale-105 active:scale-95
              hover:shadow-xl
              transition-all duration-300 ease-in-out
              relative overflow-hidden flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            Try Again
          </Button>
        </div>
      </div>
    </div>
  );
}
