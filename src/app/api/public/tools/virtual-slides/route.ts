import { NextResponse } from 'next/server'
import { R2_DATA_PUBLIC_URL } from "@/shared/config/r2-public-urls";

export const dynamic = 'force-dynamic' // Prevent pre-rendering during build
export const revalidate = 86400 // 24h ISR-like caching

/**
 * @swagger
 * /api/public/tools/virtual-slides:
 *   get:
 *     summary: Get virtual slides dataset
 *     description: Retrieve the complete virtual slides dataset (v8 optimized format) from Cloudflare R2 storage. Response is cached for 24 hours with ISR-like revalidation.
 *     tags:
 *       - Public - Tools
 *     responses:
 *       200:
 *         description: Successfully retrieved virtual slides dataset
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               description: Virtual slides dataset in v8 optimized format (structure varies)
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
  const base = process.env.CLOUDFLARE_R2_DATA_PUBLIC_URL || R2_DATA_PUBLIC_URL
  const url = `${base}/virtual-slides/virtual-slides-v8-min.json.br`
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
  } catch (err) {
    return NextResponse.json({ error: 'Proxy fetch error', message: err?.message || 'Unknown error' }, { status: 500 })
  }
}

