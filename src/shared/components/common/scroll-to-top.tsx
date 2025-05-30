/**
 * @source src/components/landing/scroll-to-top.tsx
 * 
 * A React component that renders a "Scroll to Top" button which becomes visible 
 * when the user scrolls past a specified threshold. The button smoothly scrolls 
 * the page back to the top when clicked.
 */

'use client'

import { useState, useEffect } from "react"
import { ArrowUpIcon } from "lucide-react"
import { cn } from "@/shared/utils"

interface ScrollToTopProps {
  threshold?: number // Scroll threshold in pixels
  className?: string // Additional classes for the button
}

export function ScrollToTopButton({ 
  threshold = 500, 
  className 
}: ScrollToTopProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const toggleVisibility = () => {
      setIsVisible(window.scrollY > threshold)
    }

    // Initial check
    toggleVisibility()
    
    // Add event listener with passive option for better performance
    window.addEventListener('scroll', toggleVisibility, { passive: true })
    
    // Cleanup
    return () => window.removeEventListener('scroll', toggleVisibility)
  }, [threshold])

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    })
  }

  return (
    <button
      onClick={scrollToTop}
      aria-label="Scroll to top"
      className={cn(
        "fixed bottom-8 right-8 p-3 rounded-full bg-primary hover:bg-primary/90",
        "shadow-lg hover:shadow-xl transition-all duration-300 text-white z-50",
        "opacity-0 invisible",
        isVisible && "opacity-100 visible",
        "transition-[opacity,visibility] duration-300 ease-in-out",
        className
      )}
    >
      <ArrowUpIcon className="h-5 w-5" />
    </button>
  )
}