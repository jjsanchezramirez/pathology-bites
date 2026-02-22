import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic' // Prevent pre-rendering during build
export const revalidate = 86400 // 24h ISR-like caching

/**
 * @swagger
 * /api/public/tools/virtual-slides:
 *   get:
 *     summary: Get virtual slides dataset
 *     description: Retrieve the complete virtual slides dataset (v4 optimized format, 6.6MB) from Cloudflare R2 storage. Response is cached for 24 hours with ISR-like revalidation.
 *     tags:
 *       - Public - Tools
 *     responses:
 *       200:
 *         description: Successfully retrieved virtual slides dataset
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               description: Virtual slides dataset in v4 optimized format (structure varies)
 *         headers:
 *           Cache-Control:
 *             schema:
 *               type: string
 *               example: public, max-age=86400, stale-while-revalidate=300
 *       500:
 *         description: Internal server error or proxy fetch error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Proxy fetch error
 *                 message:
 *                   type: string
 *       502:
 *         description: Bad gateway - upstream fetch failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Upstream fetch failed
 *                 status:
 *                   type: number
 */
export async function GET() {
  const base = process.env.CLOUDFLARE_R2_DATA_PUBLIC_URL || 'https://pub-cee35549242c4118a1e03da0d07182d3.r2.dev'
  // Updated: Use the optimized v4 format (6.6MB, non-gzipped for API compatibility)
  const url = `${base}/virtual-slides/virtual-slides-v4-min.json`
  try {
    // Note: This endpoint returns the optimized v4 dataset (6.6MB)
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
  } catch (err) {
    return NextResponse.json({ error: 'Proxy fetch error', message: err?.message || 'Unknown error' }, { status: 500 })
  }
}

