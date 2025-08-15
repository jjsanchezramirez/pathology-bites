import { NextResponse } from 'next/server'

export async function GET() {
  const base = process.env.CLOUDFLARE_R2_DATA_PUBLIC_URL || 'https://pub-cee35549242c4118a1e03da0d07182d3.r2.dev'
  const url = `${base}/cell-quiz/cell-quiz-images.json`
  try {
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
