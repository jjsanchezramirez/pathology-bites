#!/usr/bin/env node
/**
 * Generate a single-file, client-side search JSON for Virtual Slides
 * - Source: R2 object (virtual-slides-optimized.json) or local file
 * - Output: dist/data/virtual-slides-search-v2.<hash>.json
 * - Optional upload back to R2 with long-lived immutable cache headers
 *
 * Env vars:
 *   CLOUDFLARE_ACCOUNT_ID
 *   CLOUDFLARE_R2_ACCESS_KEY_ID
 *   CLOUDFLARE_R2_SECRET_ACCESS_KEY
 *   SRC_BUCKET=pathology-bites-data
 *   SRC_KEY=virtual-slides-optimized.json
 *   DEST_BUCKET=pathology-bites-data (or your public bucket)
 *   UPLOAD=1 (to upload to R2)
 *   SRC_PATH=./data/virtual-slides-optimized.json (to use local file instead of R2)
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3')

function tokenize(str) {
  return (str.toLowerCase().match(/[a-z0-9]+/g) || [])
}
function makeAcr(diagnosis) {
  const words = tokenize(diagnosis)
  if (words.length < 2) return ''
  return words.map(w => w[0]).join('')
}

async function readStreamToString(stream) {
  const chunks = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks).toString('utf-8')
}

async function loadSourceSlides() {
  const { SRC_PATH } = process.env
  if (SRC_PATH) {
    console.log(`📄 Reading local file: ${SRC_PATH}`)
    const raw = fs.readFileSync(SRC_PATH, 'utf-8')
    return JSON.parse(raw)
  }

  const {
    CLOUDFLARE_ACCOUNT_ID,
    CLOUDFLARE_R2_ACCESS_KEY_ID,
    CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    SRC_BUCKET = 'pathology-bites-data',
    SRC_KEY = 'virtual-slides-optimized.json'
  } = process.env

  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_R2_ACCESS_KEY_ID || !CLOUDFLARE_R2_SECRET_ACCESS_KEY) {
    throw new Error('Missing Cloudflare R2 credentials env vars')
  }

  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: CLOUDFLARE_R2_ACCESS_KEY_ID,
      secretAccessKey: CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    },
  })

  console.log(`☁️  Fetching ${SRC_BUCKET}/${SRC_KEY} from R2...`)
  const res = await s3.send(new GetObjectCommand({ Bucket: SRC_BUCKET, Key: SRC_KEY }))
  const body = await readStreamToString(res.Body)
  return JSON.parse(body)
}

function buildClientEntries(srcSlides) {
  console.log(`🔧 Building minimal entries from ${srcSlides.length} slides...`)
  // Only include fields required for client search/UI
  return srcSlides.map(s => ({
    id: s.id,
    diagnosis: s.diagnosis || '',
    category: s.category || '',
    subcategory: s.subcategory || '',
    acr: makeAcr(s.diagnosis || ''),
    // Optional UI conveniences (comment out if you want the leanest file)
    patient_info: s.patient_info || '',
    age: s.age ?? null,
    gender: s.gender ?? null,
    clinical_history: s.clinical_history || '',
    stain_type: s.stain_type || '',
    preview_image_url: s.preview_image_url || '',
    slide_url: s.slide_url || '',
    case_url: s.case_url || '',
    other_urls: Array.isArray(s.other_urls) ? s.other_urls : [],
  }))
}

function writeLocalFile(entries) {
  const outDir = path.join(process.cwd(), 'dist', 'data')
  fs.mkdirSync(outDir, { recursive: true })

  const json = JSON.stringify(entries)
  const hash = crypto.createHash('sha256').update(json).digest('hex').slice(0, 16)
  const filename = `virtual-slides-search-v2.${hash}.json`
  const outPath = path.join(outDir, filename)
  fs.writeFileSync(outPath, json)

  console.log(`✅ Wrote ${entries.length} entries to ${outPath}`)
  return { filename, outPath, hash }
}

async function uploadToR2(outPath, destKey) {
  const {
    CLOUDFLARE_ACCOUNT_ID,
    CLOUDFLARE_R2_ACCESS_KEY_ID,
    CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    DEST_BUCKET = 'pathology-bites-data'
  } = process.env

  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: CLOUDFLARE_R2_ACCESS_KEY_ID,
      secretAccessKey: CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    },
  })

  const body = fs.readFileSync(outPath)
  await s3.send(new PutObjectCommand({
    Bucket: DEST_BUCKET,
    Key: destKey,
    Body: body,
    ContentType: 'application/json',
    CacheControl: 'public, max-age=31536000, immutable'
  }))
  console.log(`☁️  Uploaded to r2://${DEST_BUCKET}/${destKey}`)
}

async function main() {
  const slides = await loadSourceSlides()
  const entries = buildClientEntries(slides)
  const { outPath, filename } = writeLocalFile(entries)

  if (process.env.UPLOAD === '1') {
    const destKey = process.env.DEST_KEY || `virtual-slides/${filename}`
    await uploadToR2(outPath, destKey)
    console.log('\nSet your public URL for this object, e.g.:')
    console.log(`https://<your-public-r2-domain>/${destKey}`)
  } else {
    console.log('\nUpload disabled. To upload to R2, re-run with UPLOAD=1')
  }
}

main().catch(err => {
  console.error('❌ Generator failed:', err)
  process.exit(1)
})

