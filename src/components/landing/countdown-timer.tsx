// src/components/landing/countdown-timer.tsx
'use client'

import { useState, useEffect, useMemo } from 'react'

type TimeUnit = {
  value: number
  label: string
}

type CountdownState = {
  days: number
  hours: number
  minutes: number
  seconds: number
}

interface CountdownTimerProps {
  launchDateStr: string
}

export function CountdownTimer({ launchDateStr }: CountdownTimerProps) {
  // Memoize the launch date to avoid recreating it on every render
  const launchDate = useMemo(() => new Date(launchDateStr), [launchDateStr])
  const [isClient, setIsClient] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  
  // Initialize with zeros for server rendering
  const [countdown, setCountdown] = useState<CountdownState>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  })

  // Mark as client-side rendered on mount and start fade-in
  useEffect(() => {
    setIsClient(true)

    // Now calculate the initial values client-side
    const now = new Date()
    const difference = launchDate.getTime() - now.getTime()
    
    if (difference > 0) {
      setCountdown({
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60)
      })
    }

    // Start fade in after a short delay to ensure values are calculated
    const timer = setTimeout(() => {
      setIsVisible(true)
    }, 300)

    return () => clearTimeout(timer)
  }, [launchDate])

  // Set up the countdown timer effect
  useEffect(() => {
    if (!isClient) return;
    
    const calculateTimeLeft = () => {
      const now = new Date()
      const difference = launchDate.getTime() - now.getTime()
      
      if (difference <= 0) {
        // Launch date has passed
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 })
        return false
      }
      
      // Calculate time units
      const days = Math.floor(difference / (1000 * 60 * 60 * 24))
      const hours = Math.floor((difference / (1000 * 60 * 60)) % 24)
      const minutes = Math.floor((difference / 1000 / 60) % 60)
      const seconds = Math.floor((difference / 1000) % 60)
      
      // Only update state if values have changed
      setCountdown(prev => {
        if (
          prev.days !== days ||
          prev.hours !== hours ||
          prev.minutes !== minutes ||
          prev.seconds !== seconds
        ) {
          return { days, hours, minutes, seconds }
        }
        return prev
      })
      
      return true
    }
    
    // If launch date has passed, don't set up the interval
    if (launchDate <= new Date()) return;
    
    // Update every second
    const timer = setInterval(calculateTimeLeft, 1000)
    
    return () => clearInterval(timer)
  }, [launchDate, isClient])
  
  const timeUnits: TimeUnit[] = [
    { value: countdown.days, label: 'Days' },
    { value: countdown.hours, label: 'Hours' },
    { value: countdown.minutes, label: 'Minutes' },
    { value: countdown.seconds, label: 'Seconds' }
  ]
  
  return (
    <div 
      className="grid grid-cols-4 gap-2 md:gap-4 max-w-md mx-auto"
      aria-label={isClient ? `Countdown to launch: ${countdown.days} days, ${countdown.hours} hours, ${countdown.minutes} minutes, and ${countdown.seconds} seconds remaining` : "Countdown to launch"}
    >
      {timeUnits.map((unit, index) => (
        <div key={unit.label} className="flex flex-col items-center">
          <div 
            className={`bg-white rounded-lg shadow-md w-full aspect-square flex items-center justify-center overflow-hidden
              ${!isClient ? "animate-pulse" : ""}`}
            aria-hidden="true"
          >
            <span 
              className={`text-2xl md:text-4xl font-bold transition-all duration-500 ease-in-out
                ${isVisible ? "opacity-100 transform translate-y-0" : "opacity-0 transform translate-y-4"}`}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              {unit.value}
            </span>
          </div>
          <span className="text-xs md:text-sm text-muted-foreground mt-2">{unit.label}</span>
        </div>
      ))}
    </div>
  )
}