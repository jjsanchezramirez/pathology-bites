import { NextResponse } from 'next/server'

/**
 * @swagger
 * /api/public/tools/cell-quiz/references:
 *   get:
 *     summary: Get cell quiz references dataset
 *     description: Retrieve the complete cell quiz references dataset from Cloudflare R2 storage. Response is cached for 24 hours.
 *     tags:
 *       - Public - Tools
 *     responses:
 *       200:
 *         description: Successfully retrieved cell quiz references
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               description: Cell quiz references dataset (structure varies)
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
  // Hard-coded R2 data URL - this is a public, static URL that doesn't change
  const base = 'https://pub-cee35549242c4118a1e03da0d07182d3.r2.dev'
  const url = `${base}/cell-quiz/cell-quiz-references.json`
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
