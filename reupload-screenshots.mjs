#!/usr/bin/env node
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { readFileSync, readdirSync, promises as fs } from 'fs';
import path from 'path';

// Load env
const envContent = readFileSync('.env.local', 'utf-8');
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#][^=]+)=(.*)$/);
  if (match) {
    const [, key, value] = match;
    process.env[key.trim()] = value.trim();
  }
});

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  },
});

const CONTENT_TYPE_MAP = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
};

function getContentType(filename) {
  const ext = path.extname(filename).toLowerCase();
  return CONTENT_TYPE_MAP[ext] || 'application/octet-stream';
}

function sanitizeFilename(filename) {
  // Replace ALL whitespace characters (including non-breaking spaces, thin spaces, etc.) with underscores
  // \s matches standard spaces, tabs, newlines
  // \u00A0 is non-breaking space (NBSP)
  // \u2000-\u200B are various Unicode spaces (en space, em space, thin space, hair space, zero-width space, etc.)
  // \u202F is narrow no-break space (used by macOS screenshots)
  // \uFEFF is zero-width no-break space
  return filename.replace(/[\s\u00A0\u2000-\u200B\u202F\uFEFF]/g, '_');
}

async function uploadFile(originalFilename) {
  const sanitizedFilename = sanitizeFilename(originalFilename);
  const filePath = path.join('anki/media', originalFilename);
  const fileBuffer = await fs.readFile(filePath);
  const contentType = getContentType(sanitizedFilename);

  const command = new PutObjectCommand({
    Bucket: 'pathology-bites-images',
    Key: `anki/${sanitizedFilename}`,
    Body: fileBuffer,
    ContentType: contentType,
  });

  await client.send(command);
  return fileBuffer.length;
}

async function main() {
  console.log('🔍 Finding Screenshot files in local media folder...\n');

  const mediaDir = 'anki/media';
  const allFiles = readdirSync(mediaDir);
  const screenshotFiles = allFiles.filter(f => f.startsWith('Screenshot'));

  console.log(`Found ${screenshotFiles.length} Screenshot files to upload\n`);

  if (screenshotFiles.length === 0) {
    console.log('✅ No Screenshot files found locally');
    return;
  }

  console.log('Sample files to upload:');
  screenshotFiles.slice(0, 5).forEach(f => {
    const sanitized = sanitizeFilename(f);
    console.log(`  ${f} → ${sanitized}`);
  });
  console.log('');

  console.log('📤 Uploading Screenshot files with sanitized names...\n');

  const BATCH_SIZE = 10;
  let uploaded = 0;
  let failed = 0;
  let totalBytes = 0;
  const startTime = Date.now();

  for (let i = 0; i < screenshotFiles.length; i += BATCH_SIZE) {
    const batch = screenshotFiles.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(screenshotFiles.length / BATCH_SIZE);

    console.log(`Batch ${batchNum}/${totalBatches} (${i + 1}-${Math.min(i + BATCH_SIZE, screenshotFiles.length)}/${screenshotFiles.length})`);

    const results = await Promise.allSettled(
      batch.map(filename => uploadFile(filename))
    );

    results.forEach((result, idx) => {
      const filename = batch[idx];
      const sanitized = sanitizeFilename(filename);
      if (result.status === 'fulfilled') {
        uploaded++;
        totalBytes += result.value;
        console.log(`  ✓ ${sanitized}`);
      } else {
        failed++;
        console.log(`  ✗ ${filename}: ${result.reason.message}`);
      }
    });

    const elapsed = (Date.now() - startTime) / 1000;
    const rate = (uploaded + failed) / elapsed;
    const remaining = screenshotFiles.length - (uploaded + failed);
    const eta = remaining / rate;

    console.log(`  Progress: ${uploaded} uploaded, ${failed} failed | ${rate.toFixed(1)} files/s | ETA: ${Math.round(eta)}s\n`);
  }

  const duration = (Date.now() - startTime) / 1000;

  console.log('==================================================');
  console.log('Upload Complete');
  console.log('==================================================');
  console.log(`Total files: ${screenshotFiles.length}`);
  console.log(`Uploaded: ${uploaded}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total size: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Duration: ${duration.toFixed(1)}s`);
  console.log(`Average rate: ${(screenshotFiles.length / duration).toFixed(1)} files/s`);

  if (failed === 0) {
    console.log('\n✅ All Screenshot files uploaded successfully with sanitized names!');
  } else {
    console.log(`\n⚠️  ${failed} files failed to upload`);
  }
}

main().catch(console.error);
