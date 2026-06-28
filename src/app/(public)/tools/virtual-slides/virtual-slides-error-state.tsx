"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useLottieAnimation } from "@/shared/hooks/use-lottie-animation";
import { Card } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { RefreshCw } from "lucide-react";
import { PublicHero } from "@/shared/components/common/public-hero";

// Dynamically import Lottie to avoid SSR issues
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

export function VirtualSlidesErrorState({ error }: { error: string }) {
  const { animationData } = useLottieAnimation("error");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lottieRef = useRef<any>(null);

  useEffect(() => {
    if (lottieRef.current && animationData) {
      const anim = lottieRef.current;
      let active = true;

      // Play forward-reverse loop. `active` guard prevents a queued `complete` from calling
      // play() after unmount/destroy, which would resurrect (and thus leak) the animation.
      const handleComplete = () => {
        if (!active || !anim.animationItem) return;
        anim.animationItem.setDirection(anim.animationItem.playDirection * -1);
        anim.animationItem.play();
      };

      anim.animationItem?.addEventListener("complete", handleComplete);

      return () => {
        active = false;
        anim.animationItem?.removeEventListener("complete", handleComplete);
      };
    }
  }, [animationData]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicHero
        title="Virtual Slide Search Engine"
        description="Search and explore thousands of virtual pathology slides from leading institutions worldwide."
      />
      <div className="container mx-auto px-4 py-4 md:py-8 max-w-6xl">
        <Card className="p-8 md:p-12 text-center">
          {/* Lottie Animation - Forward-reverse loop */}
          {animationData && (
            <div className="w-full max-w-[200px] mx-auto mb-6">
              <Lottie
                lottieRef={lottieRef}
                animationData={animationData}
                loop={false}
                autoplay={true}
                style={{ width: "100%", height: "auto" }}
              />
            </div>
          )}

          <h3 className="text-xl font-semibold mb-3">Failed to Load Virtual Slides</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            {error || "Unknown error occurred"}
          </p>
          <Button onClick={() => window.location.reload()} size="lg">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </Card>
      </div>
    </div>
  );
}
