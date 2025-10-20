// Input Validation Utilities
import { NextRequest, NextResponse } from 'next/server'

// Validation schemas using Zod (recommended) or custom validation
export interface ValidationResult {
  isValid: boolean
  errors?: string[]
  data?: any
}

// Generic request body validator
export async function validateRequestBody(
  request: NextRequest,
  validator: (data: any) => ValidationResult
): Promise<{ isValid: boolean; data?: any; response?: NextResponse }> {
  try {
    const body = await request.json()
    const validation = validator(body)
    
    if (!validation.isValid) {
      return {
        isValid: false,
        response: NextResponse.json(
          {
            success: false,
            error: 'Validation failed',
            details: validation.errors
          },
          { status: 400 }
        )
      }
    }
    
    return { isValid: true, data: validation.data }
  } catch {
    return {
      isValid: false,
      response: NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON in request body'
        },
        { status: 400 }
      )
    }
  }
}

// Query parameter validator
export function validateQueryParams(
  searchParams: URLSearchParams,
  validator: (params: Record<string, string>) => ValidationResult
): { isValid: boolean; data?: any; response?: NextResponse } {
  const params: Record<string, string> = {}
  searchParams.forEach((value, key) => {
    params[key] = value
  })
  
  const validation = validator(params)
  
  if (!validation.isValid) {
    return {
      isValid: false,
      response: NextResponse.json(
        {
          success: false,
          error: 'Invalid query parameters',
          details: validation.errors
        },
        { status: 400 }
      )
    }
  }
  
  return { isValid: true, data: validation.data }
}

// Common validation functions
export const validators = {
  email: (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
  uuid: (id: string): boolean => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id),
  positiveInteger: (num: any): boolean => Number.isInteger(num) && num > 0,
  nonEmptyString: (str: any): boolean => typeof str === 'string' && str.trim().length > 0
}

// Example usage in an endpoint:
/*
export async function POST(request: NextRequest) {
  // Validate request body
  const validation = await validateRequestBody(request, (data) => {
    const errors: string[] = []
    
    if (!validators.nonEmptyString(data.title)) {
      errors.push('Title is required and must be a non-empty string')
    }
    
    if (!validators.email(data.email)) {
      errors.push('Valid email is required')
    }
    
    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      data: errors.length === 0 ? data : undefined
    }
  })
  
  if (!validation.isValid) {
    return validation.response!
  }
  
  // Use validation.data safely
  const { title, email } = validation.data
  
  // ... rest of endpoint logic
}
*/