"use client"

import { useState, useEffect } from "react"
import { Button } from "@/shared/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { CircularProgress } from "@/shared/components/ui/circular-progress"
import confetti from "canvas-confetti"

export default function AnimationsTestPage() {
  const [score, setScore] = useState(85)
  const [previousScore, setPreviousScore] = useState(85)

  // Auto-trigger confetti for good scores (>=80)
  useEffect(() => {
    if (score >= 80 && previousScore < 80) {
      setTimeout(() => triggerConfetti(), 1000) // Delay to let letter animation start
    }
    setPreviousScore(score)
  }, [score, previousScore])

  const triggerConfetti = () => {
    // Enhanced confetti with staggered bursts for more natural feel
    const delays = [0, 150, 400, 700]
    
    delays.forEach((delay, index) => {
      setTimeout(() => {
        confetti({
          particleCount: index === 0 ? 150 : 75,
          spread: 90 - (index * 10),
          origin: { y: 0.6, x: 0.3 + (index * 0.15) },
          colors: ['#16a34a', '#22d3ee', '#f59e0b', '#ec4899'],
          gravity: 0.7,
          scalar: 1.1
        })
      }, delay)
    })
  }

  const getPerformanceMessage = (score: number) => {
    if (score >= 95) return "Outstanding!"
    if (score >= 90) return "Excellent!"
    if (score >= 80) return "Wonderful!"
    if (score >= 70) return "Great Job!"
    if (score >= 60) return "Good Work!"
    if (score >= 50) return "Keep Trying!"
    return "Room for Growth"
  }

  const getPerformanceDescription = (score: number) => {
    if (score >= 95) return "Perfect mastery of the material"
    if (score >= 90) return "Exceptional understanding demonstrated"
    if (score >= 80) return "Strong grasp of the concepts"
    if (score >= 70) return "Solid performance with minor gaps"
    if (score >= 60) return "Fair understanding, some review needed"
    if (score >= 50) return "Basic comprehension, more practice required"
    return "Significant improvement needed"
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Quiz Results Animation Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex gap-4 items-center">
            <label>Score:</label>
            <input
              type="range"
              min="0"
              max="100"
              value={score}
              onChange={(e) => setScore(parseInt(e.target.value))}
              className="flex-1"
            />
            <span className="w-12 text-center">{score}%</span>
          </div>

          <Button onClick={triggerConfetti}>Trigger Confetti</Button>

          {/* Circular Progress Test */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Circular Progress Test</h3>
            <div className="flex justify-center">
              <CircularProgress value={score} size={200} strokeWidth={16} />
            </div>
            <p className="text-center text-sm text-muted-foreground">
              Circular progress showing {score}% - adjust the slider above to test
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Performance Message Demo */}
      <div className="text-center space-y-6">
        <div className="max-w-lg mx-auto space-y-3">
          <div className="animate-in fade-in-0 slide-in-from-bottom-6 duration-1000 ease-out">
            <h1 className={`text-5xl md:text-6xl font-black transform transition-all duration-1000 delay-300 hover:scale-105 performance-message ${
              score <= 40 ? 'text-destructive animate-wobble' : score >= 95 ? 'text-celebration' : score >= 80 ? 'text-primary' : 'text-foreground'
            }`}>
              {score >= 80 ? (
                // Letter drop animation for excellent performance
                <span className="inline-block">
                  {getPerformanceMessage(score).split('').map((letter, index) => (
                    <span
                      key={index}
                      className="inline-block animate-letter-drop"
                      style={{
                        animationDelay: `${index * 100 + 500}ms`,
                        animationFillMode: 'both'
                      }}
                    >
                      {letter === ' ' ? '\u00A0' : letter}
                    </span>
                  ))}
                </span>
              ) : score > 40 && score < 80 ? (
                // Letter fade animation for average performance
                <span className="inline-block">
                  {getPerformanceMessage(score).split('').map((letter, index) => (
                    <span
                      key={index}
                      className="inline-block animate-letter-fade"
                      style={{
                        animationDelay: `${index * 50 + 300}ms`,
                        animationFillMode: 'both'
                      }}
                    >
                      {letter === ' ' ? '\u00A0' : letter}
                    </span>
                  ))}
                </span>
              ) : (
                // Jittery caffeinated animation for poor scores - nervous energy
                <span className="inline-block">
                  {getPerformanceMessage(score).split('').map((letter, index) => {
                    // Irregular timing for nervous feel
                    const baseDelay = index * 60 + 150
                    const randomOffset = Math.random() * 80 - 40 // -40 to 40ms variation
                    
                    return (
                      <span
                        key={index}
                        className="inline-block animate-letter-jittery"
                        style={{
                          '--letter-delay': `${baseDelay + randomOffset}ms`,
                          animationFillMode: 'both'
                        } as React.CSSProperties}
                      >
                        {letter === ' ' ? '\u00A0' : letter}
                      </span>
                    )
                  })}
                </span>
              )}
            </h1>
          </div>
          <div className="animate-in fade-in-0 slide-in-from-bottom-4 duration-800 delay-700 ease-out">
            <p className="text-xl font-medium tracking-wide text-muted-foreground transform transition-all duration-500 hover:text-foreground performance-message">
              {getPerformanceDescription(score)}
            </p>
          </div>
        </div>
      </div>

      {/* Animation Examples */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        <Card>
          <CardHeader>
            <CardTitle>Score-Based Animations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-center">
              <div>
                <span className="inline-block text-lg font-bold text-destructive">
                  {"Poor Performance".split('').map((letter, index) => (
                    <span
                      key={index}
                      className="inline-block animate-letter-jittery"
                      style={{
                        '--letter-delay': `${index * 60}ms`,
                        animationFillMode: 'both'
                      } as React.CSSProperties}
                    >
                      {letter === ' ' ? '\u00A0' : letter}
                    </span>
                  ))}
                </span>
                <p className="text-xs text-muted-foreground">≤40%: Red + Jittery Letters</p>
              </div>
              <div>
                <span className="inline-block text-lg font-bold text-foreground">
                  {"Average Performance".split('').map((letter, index) => (
                    <span
                      key={index}
                      className="inline-block animate-letter-fade"
                      style={{
                        animationDelay: `${index * 50}ms`,
                        animationFillMode: 'both'
                      }}
                    >
                      {letter === ' ' ? '\u00A0' : letter}
                    </span>
                  ))}
                </span>
                <p className="text-xs text-muted-foreground">40-80%: Default + Letter Fade</p>
              </div>
              <div>
                <span className="inline-block text-lg font-bold text-primary">
                  {"Great Performance!".split('').map((letter, index) => (
                    <span
                      key={index}
                      className="inline-block animate-letter-drop"
                      style={{
                        animationDelay: `${index * 100}ms`,
                        animationFillMode: 'both'
                      }}
                    >
                      {letter === ' ' ? '\u00A0' : letter}
                    </span>
                  ))}
                </span>
                <p className="text-xs text-muted-foreground mt-2">≥80%: Teal + Letter Drop + Confetti</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Progress Circle Colors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-center">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <CircularProgress value={60} size={100} strokeWidth={10} />
                  <p className="text-xs text-muted-foreground mt-2">&lt;80%: Red</p>
                </div>
                <div>
                  <CircularProgress value={90} size={100} strokeWidth={10} />
                  <p className="text-xs text-muted-foreground mt-2">≥80%: Teal</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Simple two-color system</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
