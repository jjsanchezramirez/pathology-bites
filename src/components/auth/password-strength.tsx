// src/components/auth/password-strength.tsx
"use client"

import { useState, useEffect } from "react"

interface PasswordStrengthProps {
  password: string
}

export function PasswordStrength({ password }: PasswordStrengthProps) {
  const [strength, setStrength] = useState(0)
  const [feedback, setFeedback] = useState("")
  
  useEffect(() => {
    if (!password) {
      setStrength(0)
      setFeedback("")
      return
    }
    
    let score = 0
    let message = ""
    
    // Length check
    if (password.length >= 8) score += 1
    if (password.length >= 12) score += 1
    
    // Character types
    if (/[A-Z]/.test(password)) score += 1
    if (/[a-z]/.test(password)) score += 1
    if (/[0-9]/.test(password)) score += 1
    if (/[^A-Za-z0-9]/.test(password)) score += 1
    
    // Common patterns
    if (/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(password)) {
      score += 2
    }
    
    // Common passwords check (simplified)
    const commonPasswords = ['password', '123456', 'qwerty', 'admin', 'welcome']
    if (commonPasswords.includes(password.toLowerCase())) {
      score = 1
    }
    
    // Sequential characters check
    if (/012|123|234|345|456|567|678|789|abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz/i.test(password)) {
      score -= 1
    }
    
    // Normalize score (0-5)
    score = Math.max(0, Math.min(5, score))
    
    // Set feedback based on score
    switch (score) {
      case 0:
        message = "Very weak"
        break
      case 1:
        message = "Weak"
        break
      case 2:
        message = "Fair"
        break
      case 3:
        message = "Good"
        break
      case 4:
        message = "Strong"
        break
      case 5:
        message = "Very strong"
        break
    }
    
    setStrength(score)
    setFeedback(message)
  }, [password])
  
  // Generate colors for strength bars
  const getBarColor = (index: number) => {
    if (index >= strength) return "bg-gray-200"
    
    if (strength <= 1) return "bg-red-500"
    if (strength <= 2) return "bg-orange-500"
    if (strength <= 3) return "bg-yellow-500"
    if (strength <= 4) return "bg-green-500"
    return "bg-green-600"
  }
  
  // Get text color for feedback
  const getTextColor = () => {
    if (strength <= 1) return "text-red-500"
    if (strength <= 2) return "text-orange-500"
    if (strength <= 3) return "text-yellow-500"
    if (strength >= 4) return "text-green-500"
    return "text-gray-500"
  }
  
  if (!password) return null
  
  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-1">
        {[...Array(5)].map((_, i) => (
          <div 
            key={i} 
            className={`h-1 rounded-full flex-1 transition-colors ${getBarColor(i)}`} 
          />
        ))}
      </div>
      <p className={`text-xs ${getTextColor()}`}>
        {feedback}
      </p>
    </div>
  )
}