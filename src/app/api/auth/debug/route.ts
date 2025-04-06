// src/app/api/auth/debug/route.ts
import { createClient } from '@/lib/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.getSession()
    
    return NextResponse.json({
      hasSession: !!data.session,
      error: error ? error.message : null
    })
  } catch (e) {
    return NextResponse.json({
      error: e instanceof Error ? e.message : 'Unknown error'
    }, { status: 500 })
  }
}