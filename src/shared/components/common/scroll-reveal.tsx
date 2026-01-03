"use client";

import { useScrollAnimation } from "@/shared/hooks/use-scroll-animation";

interface ScrollRevealProps {
  children: React.ReactNode;
  animation?: "fade-up" | "fade-in" | "scale-in" | "slide-left" | "slide-right";
  delay?: number;
  className?: string;
}

export function ScrollReveal({
  children,
  animation = "fade-up",
  delay = 0,
  className = "",
}: ScrollRevealProps) {
  const { elementRef, isVisible } = useScrollAnimation();

  const animationClass = `scroll-${animation}`;

  return (
    <div
      ref={elementRef as React.RefObject<HTMLDivElement>}
      className={`${animationClass} ${isVisible ? "visible" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
