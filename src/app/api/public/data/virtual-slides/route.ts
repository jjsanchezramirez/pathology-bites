import { NextResponse } from 'next/server'

export const revalidate = 86400 // 24h ISR-like caching

export async function GET() {
  const base = process.env.CLOUDFLARE_R2_DATA_PUBLIC_URL || 'https://pub-cee35549242c4118a1e03da0d07182d3.r2.dev'
  const url = `${base}/virtual-slides/virtual-slides.json`
  try {
    // Note: This endpoint returns the full 15MB dataset for compatibility
    // For large file handling, Next.js will show a caching warning during build
    // This is expected and doesn't affect functionality - just means the response
    // won't be cached by Next.js (but browser/CDN caching still works)
    const res = await fetch(url, { next: { revalidate: 86400 } })
    if (!res.ok) {
      return NextResponse.json({ error: 'Upstream fetch failed', status: res.status }, { status: 502 })
    }
    const data = await res.json()
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=300',
      }
    })
  } catch (err: any) {
    return NextResponse.json({ error: 'Proxy fetch error', message: err?.message || 'Unknown error' }, { status: 500 })
  }
}

