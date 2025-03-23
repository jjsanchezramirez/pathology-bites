// src/components/auth/password-requirements.tsx
"use client"

import { useState, useEffect } from "react"
import { Check, X } from "lucide-react"

interface PasswordRequirementsProps {
  password: string
  visible: boolean
}

export function PasswordRequirements({ password, visible }: PasswordRequirementsProps) {
  const [requirements, setRequirements] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false,
  })
  
  useEffect(() => {
    if (!password) {
      setRequirements({
        length: false,
        uppercase: false,
        lowercase: false,
        number: false,
        special: false,
      })
      return
    }
    
    setRequirements({
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[^A-Za-z0-9]/.test(password),
    })
  }, [password])
  
  if (!visible) return null
  
  return (
    <div className="mt-2 text-sm space-y-1 px-3 py-2 bg-muted/50 rounded-md border">
      <p className="font-medium text-xs text-muted-foreground mb-1">Password requirements:</p>
      <ul className="space-y-1">
        <li className="flex items-center space-x-2">
          {requirements.length ? (
            <Check className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <span className={requirements.length ? "text-xs" : "text-xs text-muted-foreground"}>
            At least 8 characters long
          </span>
        </li>
        <li className="flex items-center space-x-2">
          {requirements.uppercase ? (
            <Check className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <span className={requirements.uppercase ? "text-xs" : "text-xs text-muted-foreground"}>
            At least one uppercase letter (A-Z)
          </span>
        </li>
        <li className="flex items-center space-x-2">
          {requirements.lowercase ? (
            <Check className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <span className={requirements.lowercase ? "text-xs" : "text-xs text-muted-foreground"}>
            At least one lowercase letter (a-z)
          </span>
        </li>
        <li className="flex items-center space-x-2">
          {requirements.number ? (
            <Check className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <span className={requirements.number ? "text-xs" : "text-xs text-muted-foreground"}>
            At least one number (0-9)
          </span>
        </li>
        <li className="flex items-center space-x-2">
          {requirements.special ? (
            <Check className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <span className={requirements.special ? "text-xs" : "text-xs text-muted-foreground"}>
            At least one special character (e.g. !@#$%^&*)
          </span>
        </li>
      </ul>
    </div>
  )
}