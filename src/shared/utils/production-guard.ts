import { NextResponse } from 'next/server'

/**
 * Production guard utility for debug endpoints
 * Returns a 404 response if called in production environment
 */
export function checkProductionGuard(): NextResponse | null {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Debug endpoints are disabled in production' },
      { status: 404 }
    )
  }
  return null
}

/**
 * Wrapper function to apply production guard to any handler
 */
export function withProductionGuard<T extends (...args: any[]) => any>(handler: T): T {
  return ((...args: any[]) => {
    const guard = checkProductionGuard()
    if (guard) return guard
    return handler(...args)
  }) as T
}