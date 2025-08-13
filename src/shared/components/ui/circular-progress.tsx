// src/shared/components/ui/circular-progress.tsx
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
  animationDuration = 1000
}: CircularProgressProps) {
  const [animatedValue, setAnimatedValue] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedValue(value)
    }, 100) // Small delay to trigger animation

    return () => clearTimeout(timer)
  }, [value])

  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const strokeDasharray = circumference
  const strokeDashoffset = circumference - (animatedValue / 100) * circumference

  const getColor = (score: number) => {
    if (score >= 90) return "#10b981" // green-500
    if (score >= 80) return "#3b82f6" // blue-500
    if (score >= 70) return "#f59e0b" // amber-500
    return "#ef4444" // red-500
  }

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-gray-200"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={getColor(animatedValue)}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{
            transition: `stroke-dashoffset ${animationDuration}ms ease-in-out, stroke ${animationDuration}ms ease-in-out`
          }}
        />
      </svg>
      {showValue && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold" style={{ color: getColor(animatedValue) }}>
            {Math.round(animatedValue)}%
          </span>
        </div>
      )}
    </div>
  )
}