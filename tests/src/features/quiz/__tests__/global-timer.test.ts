// src/features/quiz/__tests__/global-timer.test.ts
import { QUIZ_TIMING_CONFIG } from '../types/quiz'

// Simple unit tests for global timer functionality

describe('Global Timer Functionality', () => {
  describe('Quiz Timing Configuration', () => {
    it('should calculate correct total time for timed quizzes', () => {
      const questionCount = 20
      const totalTime = QUIZ_TIMING_CONFIG.timed.calculateTotalTime(questionCount)

      expect(totalTime).toBe(1800) // 20 questions * 90 seconds = 1800 seconds
    })

    it('should return undefined for untimed quizzes', () => {
      const questionCount = 20
      const totalTime = QUIZ_TIMING_CONFIG.untimed.calculateTotalTime(questionCount)

      expect(totalTime).toBeUndefined()
    })

    it('should have correct per-question time for timed quizzes', () => {
      expect(QUIZ_TIMING_CONFIG.timed.timePerQuestion).toBe(90)
    })

    it('should have undefined per-question time for untimed quizzes', () => {
      expect(QUIZ_TIMING_CONFIG.untimed.timePerQuestion).toBeUndefined()
    })
  })

  describe('Global Timer Calculations', () => {
    it('should calculate correct total time for different question counts', () => {
      expect(QUIZ_TIMING_CONFIG.timed.calculateTotalTime(1)).toBe(90)
      expect(QUIZ_TIMING_CONFIG.timed.calculateTotalTime(5)).toBe(450)
      expect(QUIZ_TIMING_CONFIG.timed.calculateTotalTime(10)).toBe(900)
      expect(QUIZ_TIMING_CONFIG.timed.calculateTotalTime(25)).toBe(2250)
      expect(QUIZ_TIMING_CONFIG.timed.calculateTotalTime(50)).toBe(4500)
    })

    it('should handle edge cases for question counts', () => {
      expect(QUIZ_TIMING_CONFIG.timed.calculateTotalTime(0)).toBe(0)
      expect(QUIZ_TIMING_CONFIG.untimed.calculateTotalTime(100)).toBeUndefined()
    })
  })
})

describe('Timer Display Formatting', () => {
  // Helper function to format time (would be imported from the actual component)
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  it('should format time correctly', () => {
    expect(formatTime(90)).toBe('1:30')
    expect(formatTime(3600)).toBe('60:00')
    expect(formatTime(65)).toBe('1:05')
    expect(formatTime(5)).toBe('0:05')
  })
})
