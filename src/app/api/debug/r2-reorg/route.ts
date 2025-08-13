// src/app/api/debug/r2-reorg/route.ts
/**
 * R2 Reorganization Orchestrator (Preview + Execute)
 *
 * Goals (safe by default):
 * - GET = Preview inventory and plan (no writes)
 * - POST = Dry-run by default (no writes) unless explicitly execute=true
 *
 * Steps implemented:
 * 1) Inventory
 *    - Supabase public.images (id, url, category, file_type)
 *    - R2 pathology-bites-data/cell-quiz-images.json
 *    - R2 pathology-bites-images root-level images (candidate Anki media)
 * 2) Plan
 *    - Map each source to target folders:
 *      anki/, microscopic/, gross/, figure/, table/, cell-quiz/
 *      Maintain original filenames
 * 3) Execute (optional, requires execute=true)
 *    - Option A (default safer): upload organized files first, then (optionally) delete old keys
 *    - Option B (deleteFirst=true): delete everything, then upload from sources (risky) — not default
 *
 * Notes:
 * - All operations are batched to control memory/egress
 * - We stream downloads to Buffer and immediately upload; no large local disk needed
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'
import {
  uploadToR2,
  listR2Files,
  bulkDeleteFromR2,
} from '@/shared/services/r2-storage'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import fs from 'node:fs'
import path from 'node:path'

// ---------- Config helpers ----------
function getR2Config() {
  const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID
  const CLOUDFLARE_R2_ACCESS_KEY_ID = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID
  const CLOUDFLARE_R2_SECRET_ACCESS_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY

  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_R2_ACCESS_KEY_ID || !CLOUDFLARE_R2_SECRET_ACCESS_KEY) {
    throw new Error('Missing required Cloudflare R2 environment variables')
  }

  return {
    CLOUDFLARE_ACCOUNT_ID,
    CLOUDFLARE_R2_ACCESS_KEY_ID,
    CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  }
}

function createR2Client() {
  const cfg = getR2Config()
  return new S3Client({
    region: 'auto',
    endpoint: `https://${cfg.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: cfg.CLOUDFLARE_R2_ACCESS_KEY_ID,
      secretAccessKey: cfg.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    },
  })
}

// ---------- Types ----------
interface ImageRecord {
  id?: string
  url: string
  category?: string | null
  file_type?: string | null
}

interface ReorgItem {
  sourceUrl?: string
  localPath?: string
  targetKey: string
  size?: number
  sourceType: 'supabase' | 'cell-quiz' | 'anki-root' | 'anki-local'
}

interface ReorgPlan {
  counts: Record<string, number>
  samples: Record<string, string[]>
  items: ReorgItem[]
}

// ---------- Helpers ----------
function basenameFromUrl(url: string): string {
  try {
    const u = new URL(url)
    const parts = u.pathname.split('/')
    return decodeURIComponent(parts[parts.length - 1] || '')
  } catch {
    // Fallback: treat as path
    const parts = url.split('/')
    return decodeURIComponent(parts[parts.length - 1] || '')
  }
}

function guessContentType(fileName: string): string {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.svg')) return 'image/svg+xml'
  return 'application/octet-stream'
}

function isLikelyAnkiName(name: string): boolean {
  // Heuristic: many Anki media are paste-<hash>.jpg / random hash names without slashes
  const n = name.toLowerCase()
  return n.startsWith('paste-') || /^[a-f0-9]{6,}\.(png|jpg|jpeg|gif|svg|webp)$/.test(n)
}

async function fetchCellQuizImages(): Promise<string[]> {
  // Read R2 private data bucket JSON: cell-quiz-images.json
  const client = createR2Client()
  const cmd = new GetObjectCommand({ Bucket: 'pathology-bites-data', Key: 'cell-quiz-images.json' })
  const res = await client.send(cmd)
  if (!res.Body) return []
  const text = await res.Body.transformToString()
  let data: any
  try { data = JSON.parse(text) } catch { return [] }
  // Expect shape: { cellType: { images: [url, ...] }, ... }
  const urls: string[] = []
  for (const key of Object.keys(data || {})) {
    const v = data[key]
    if (v && Array.isArray(v.images)) {
      for (const u of v.images) {
        if (typeof u === 'string' && u.length > 0) urls.push(u)
      }
    }
  }
  // Uniq
  return Array.from(new Set(urls))
}

async function getSupabaseImages(): Promise<ImageRecord[]> {
  const supabase = await createClient()
  // Pull essential fields; exclude external if not needed
  const { data, error } = await supabase
    .from('images')
    .select('id, url, category, file_type')

  if (error) throw error
  return (data || []) as ImageRecord[]
}

async function listAnkiCandidatesFromR2Root(): Promise<string[]> {
  // Look at the public images bucket and collect keys with no folder separator
  const allKeys: string[] = []
  let continuation: string | undefined
  let hasMore = true

  while (hasMore) {
    const page = await listR2Files({
      bucket: 'pathology-bites-images',
      continuationToken: continuation,
      prefix: '',
      maxKeys: 1000,
    } as any)

    for (const f of page.files) {
      if (!f.key.includes('/')) {
        const name = f.key
        // Only consider common image extensions
        if (/\.(png|jpg|jpeg|webp|gif|svg)$/i.test(name) && isLikelyAnkiName(name)) {
          allKeys.push(name)
        }
      }
    }

    hasMore = page.isTruncated
    continuation = page.nextContinuationToken
  }

  return Array.from(new Set(allKeys))
}

function categorizeSupabaseImage(rec: ImageRecord): string | null {
  // Map DB category to target folder names
  const cat = (rec.category || '').toLowerCase()
  if (cat === 'microscopic') return 'microscopic/'
  if (cat === 'gross') return 'gross/'
  if (cat === 'figure') return 'figure/'
  if (cat === 'table') return 'table/'
  // Ignore others for this reorg
  return null
}

function listLocalAnkiMedia(rootDir: string): string[] {
  try {
    const entries = fs.readdirSync(rootDir)
    return entries
      .filter(name => /\.(png|jpe?g|gif|webp|svg)$/i.test(name))
      .map(name => path.join(rootDir, name))
  } catch {
    return []
  }
}

async function buildPlan(): Promise<ReorgPlan> {
  const [supabaseImages, cellQuizUrls] = await Promise.all([
    getSupabaseImages(),
    fetchCellQuizImages(),
  ])

  // Add local Anki media (./json/anki/media)
  const localAnkiDir = path.join(process.cwd(), 'json', 'anki', 'media')
  const localAnkiFiles = listLocalAnkiMedia(localAnkiDir)

  const items: ReorgItem[] = []
  const counts: Record<string, number> = {
    anki: 0, microscopic: 0, gross: 0, figure: 0, table: 0, 'cell-quiz': 0
  }
  const samples: Record<string, string[]> = {
    anki: [], microscopic: [], gross: [], figure: [], table: [], 'cell-quiz': []
  }

  // Anki (from local directory)
  for (const absPath of localAnkiFiles) {
    const name = path.basename(absPath)
    const targetKey = `anki/${name}`
    items.push({ localPath: absPath, targetKey, sourceType: 'anki-local' })
    counts.anki++
    if (samples.anki.length < 5) samples.anki.push(name)
  }

  // Supabase images
  for (const rec of supabaseImages) {
    if (!rec.url) continue
    const folder = categorizeSupabaseImage(rec)
    if (!folder) continue
    const name = basenameFromUrl(rec.url)
    if (!name) continue
    items.push({ sourceUrl: rec.url, targetKey: `${folder}${name}`, sourceType: 'supabase' })
    const key = folder.replace('/', '') as keyof typeof counts
    counts[key] = (counts[key] || 0) + 1
    if (samples[key].length < 5) samples[key].push(name)
  }

  // Cell quiz images
  for (const url of cellQuizUrls) {
    const name = basenameFromUrl(url)
    if (!name) continue
    items.push({ sourceUrl: url, targetKey: `cell-quiz/${name}`, sourceType: 'cell-quiz' })
    counts['cell-quiz']++
    if (samples['cell-quiz'].length < 5) samples['cell-quiz'].push(name)
  }

  // De-duplicate by targetKey (keep first occurrence)
  const seen = new Set<string>()
  const deduped: ReorgItem[] = []
  for (const it of items) {
    if (seen.has(it.targetKey)) continue
    seen.add(it.targetKey)
    deduped.push(it)
  }

  const plan: ReorgPlan = {
    counts,
    samples,
    items: deduped,
  }

  return plan
}

async function downloadBuffer(url: string): Promise<Buffer> {
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`Download failed ${resp.status} for ${url}`)
  const arr = await resp.arrayBuffer()
  return Buffer.from(arr)
}

function readLocalBuffer(filePath: string): Buffer {
  return fs.readFileSync(filePath)
}

async function executePlan(plan: ReorgPlan, options: { deleteFirst?: boolean, batchSize?: number, dryRun?: boolean }) {
  const { deleteFirst = false, batchSize = 50, dryRun = true } = options

  // Optionally delete existing objects FIRST (risky)
  if (!dryRun && deleteFirst) {
    // List everything once
    const allKeys: string[] = []
    let continuation: string | undefined
    let hasMore = true
    while (hasMore) {
      const page = await listR2Files({
        bucket: 'pathology-bites-images',
        continuationToken: continuation,
        prefix: '',
        maxKeys: 1000,
      } as any)
      allKeys.push(...page.files.map(f => f.key))
      hasMore = page.isTruncated
      continuation = page.nextContinuationToken
    }
    if (allKeys.length > 0) {
      // Delete in chunks of 1000
      for (let i = 0; i < allKeys.length; i += 1000) {
        const chunk = allKeys.slice(i, i + 1000)
        await bulkDeleteFromR2(chunk, 'pathology-bites-images')
      }
    }
  }

  // Upload in batches
  let uploaded = 0
  let skipped = 0
  const errors: string[] = []

  console.log(`Starting upload: ${plan.items.length} total items in batches of ${batchSize}`)

  for (let i = 0; i < plan.items.length; i += batchSize) {
    const batch = plan.items.slice(i, i + batchSize)
    const batchNum = Math.floor(i / batchSize) + 1
    const totalBatches = Math.ceil(plan.items.length / batchSize)
    
    console.log(`Processing batch ${batchNum}/${totalBatches} (items ${i + 1}-${Math.min(i + batchSize, plan.items.length)})`)
    // Parallel within batch (limited)
    await Promise.all(batch.map(async (item) => {
      try {
        if (dryRun) return
        const contentType = guessContentType(item.targetKey)
        let buf: Buffer
        if (item.localPath) {
          buf = readLocalBuffer(item.localPath)
        } else if (item.sourceUrl) {
          buf = await downloadBuffer(item.sourceUrl)
        } else {
          throw new Error('No source for item')
        }
        await uploadToR2(buf, item.targetKey, { contentType, bucket: 'pathology-bites-images' })
        uploaded++
      } catch (e: any) {
        errors.push(`${item.targetKey}: ${e?.message || e}`)
      }
    }))
  }

  return { uploaded, skipped, errors }
}

// ---------- Route Handlers ----------
export async function GET() {
  try {
    const plan = await buildPlan()
    const total = plan.items.length
    return NextResponse.json({
      success: true,
      summary: {
        total,
        counts: plan.counts,
        samples: plan.samples,
      },
      note: 'This is a preview only. No writes performed.',
    })
  } catch (error: any) {
    console.error('Reorg preview failed:', error)
    return NextResponse.json({ success: false, error: error?.message || 'Preview failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const execute = body.execute === true
    const deleteFirst = body.deleteFirst === true
    const batchSize = typeof body.batchSize === 'number' ? Math.max(5, Math.min(200, body.batchSize)) : 50

    const plan = await buildPlan()

    // Always perform a dry-run unless explicitly execute=true
    const result = await executePlan(plan, { deleteFirst, batchSize, dryRun: !execute })

    return NextResponse.json({
      success: true,
      executed: execute,
      deleteFirst,
      batchSize,
      summary: {
        counts: plan.counts,
        totalPlanned: plan.items.length,
      },
      result,
      safety: execute ? undefined : 'Dry-run only. Set { execute: true } to perform writes.'
    })
  } catch (error: any) {
    console.error('Reorg execution failed:', error)
    return NextResponse.json({ success: false, error: error?.message || 'Execution failed' }, { status: 500 })
  }
}

