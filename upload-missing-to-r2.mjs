#!/usr/bin/env node
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { readFileSync, promises as fs } from 'fs';
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
  '.jpglarge': 'image/jpeg',
  '.png_m': 'image/png'
};

function getContentType(filename) {
  const ext = path.extname(filename).toLowerCase();
  return CONTENT_TYPE_MAP[ext] || 'application/octet-stream';
}

async function uploadFile(filename) {
  const filePath = path.join('anki/media', filename);
  const fileBuffer = await fs.readFile(filePath);
  const contentType = getContentType(filename);

  const command = new PutObjectCommand({
    Bucket: 'pathology-bites-images',
    Key: `anki/${filename}`,
    Body: fileBuffer,
    ContentType: contentType,
  });

  await client.send(command);
  return fileBuffer.length;
}

async function main() {
  const missingFiles = readFileSync('/tmp/missing-in-r2.txt', 'utf-8')
    .split('\n')
    .filter(f => f.trim());

  console.log(`📤 Uploading ${missingFiles.length} missing files to R2\n`);

  const BATCH_SIZE = 10;
  let uploaded = 0;
  let failed = 0;
  let totalBytes = 0;
  const startTime = Date.now();

  for (let i = 0; i < missingFiles.length; i += BATCH_SIZE) {
    const batch = missingFiles.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(missingFiles.length / BATCH_SIZE);

    console.log(`Batch ${batchNum}/${totalBatches} (${i + 1}-${Math.min(i + BATCH_SIZE, missingFiles.length)}/${missingFiles.length})`);

    const results = await Promise.allSettled(
      batch.map(filename => uploadFile(filename))
    );

    results.forEach((result, idx) => {
      const filename = batch[idx];
      if (result.status === 'fulfilled') {
        uploaded++;
        totalBytes += result.value;
        console.log(`  ✓ ${filename}`);
      } else {
        failed++;
        console.log(`  ✗ ${filename}: ${result.reason.message}`);
      }
    });

    const elapsed = (Date.now() - startTime) / 1000;
    const rate = (uploaded + failed) / elapsed;
    const remaining = missingFiles.length - (uploaded + failed);
    const eta = remaining / rate;

    console.log(`  Progress: ${uploaded} uploaded, ${failed} failed | ${rate.toFixed(1)} files/s | ETA: ${Math.round(eta)}s\n`);
  }

  const duration = (Date.now() - startTime) / 1000;

  console.log('==================================================');
  console.log('Upload Complete');
  console.log('==================================================');
  console.log(`Total files: ${missingFiles.length}`);
  console.log(`Uploaded: ${uploaded}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total size: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Duration: ${duration.toFixed(1)}s`);
  console.log(`Average rate: ${(missingFiles.length / duration).toFixed(1)} files/s`);

  if (failed === 0) {
    console.log('\n✅ All missing files uploaded successfully!');
  } else {
    console.log(`\n⚠️  ${failed} files failed to upload`);
  }
}

main().catch(console.error);
