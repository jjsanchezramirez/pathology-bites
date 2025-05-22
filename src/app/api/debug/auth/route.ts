// src/app/api/debug/auth/route.ts
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    auth_config: {
      google_client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.substring(0, 10) + '...',
      site_url: process.env.NEXT_PUBLIC_SITE_URL,
      supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      redirect_urls: [
        `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/callback`,
        // Any other configured redirect URLs
      ],
      environment: process.env.NODE_ENV,
    }
  })
}