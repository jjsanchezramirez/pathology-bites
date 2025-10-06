// Standardized API Response Templates
import { NextResponse } from 'next/server'

export interface APIResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  details?: any
}

export class APIResponseBuilder {
  static success<T>(data: T, message?: string, status: number = 200): NextResponse {
    return NextResponse.json({
      success: true,
      data,
      message
    } as APIResponse<T>, { status })
  }

  static created<T>(data: T, message?: string): NextResponse {
    return NextResponse.json({
      success: true,
      data,
      message: message || 'Resource created successfully'
    } as APIResponse<T>, { status: 201 })
  }

  static error(
    error: string,
    status: number = 500,
    details?: any
  ): NextResponse {
    return NextResponse.json({
      success: false,
      error,
      details
    } as APIResponse, { status })
  }

  static badRequest(error: string, details?: any): NextResponse {
    return this.error(error, 400, details)
  }

  static unauthorized(error: string = 'Authentication required'): NextResponse {
    return this.error(error, 401)
  }

  static forbidden(error: string = 'Insufficient privileges'): NextResponse {
    return this.error(error, 403)
  }

  static notFound(error: string = 'Resource not found'): NextResponse {
    return this.error(error, 404)
  }

  static conflict(error: string, details?: any): NextResponse {
    return this.error(error, 409, details)
  }

  static internalError(error: string = 'Internal server error'): NextResponse {
    return this.error(error, 500)
  }
}

// Usage examples:
/*
// Success response
return APIResponseBuilder.success(userData, 'User retrieved successfully')

// Created response
return APIResponseBuilder.created(newUser, 'User created successfully')

// Error responses
return APIResponseBuilder.badRequest('Invalid input data', validationErrors)
return APIResponseBuilder.unauthorized()
return APIResponseBuilder.forbidden('Admin access required')
return APIResponseBuilder.notFound('User not found')
*/