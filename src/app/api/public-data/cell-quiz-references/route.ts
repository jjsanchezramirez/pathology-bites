// Backward compatibility redirect
import { NextResponse } from 'next/server'

export async function GET() {
  // Redirect to new consolidated endpoint
  return NextResponse.redirect(new URL('/api/public/data/cell-quiz-references', process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'))
}
