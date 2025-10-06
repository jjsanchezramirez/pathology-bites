"use client"

import { useEffect, useState } from "react"

interface CircularProgressProps {
  value: number
  size?: number
  strokeWidth?: number
  className?: string
  showValue?: boolean
  animationDuration?: number
}

export function CircularProgress({
  value,
  size = 120,
  strokeWidth = 8,
  className = "",
  showValue = true,
  animationDuration = 1500
}: CircularProgressProps) {
  const [animatedValue, setAnimatedValue] = useState(0)
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedValue(value)
    }, 100)
    return () => clearTimeout(timer)
  }, [value])

  // Return null if value is invalid
  if (value === undefined || value === null || isNaN(value)) {
    return null
  }

  const normalizedValue = Math.max(0, Math.min(100, value))
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const strokeDashoffset = circumference - (animatedValue / 100) * circumference

  // 2-tier color system - Fixed colors based on final score, not animated value
  const getStrokeColor = (score: number): string => {
    if (score < 60) return "hsl(0 84.2% 45%)" // Red for low performance
    return "hsl(var(--primary))" // Theme accent color for good performance
  }

  const strokeColor = getStrokeColor(value) // Use final value, not animated value

  return (
    <div 
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg 
        width={size} 
        height={size} 
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{
            transition: `stroke-dashoffset ${animationDuration}ms ease-out, stroke ${animationDuration}ms ease-out`
          }}
        />
      </svg>
      {showValue && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="text-2xl font-bold"
            style={{ color: strokeColor }}
          >
            {Math.round(animatedValue)}%
          </span>
        </div>
      )}
    </div>
  )
}