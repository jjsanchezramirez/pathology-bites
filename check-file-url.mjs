#!/usr/bin/env node
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';
import { readFileSync } from 'fs';

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

const testFiles = [
  'Screenshot_2025-11-16_at_8.47.43_PM.png',
  'Screenshot_2025-11-16_at_8.46.57_PM.png',
  'Screenshot_2025-11-16_at_8.45.55_PM.png',
];

console.log('Checking files in R2...\n');
console.log(`Public URL base: ${process.env.CLOUDFLARE_R2_PUBLIC_URL}\n`);

for (const filename of testFiles) {
  try {
    const response = await client.send(new HeadObjectCommand({
      Bucket: 'pathology-bites-images',
      Key: `anki/${filename}`,
    }));

    const url = `${process.env.CLOUDFLARE_R2_PUBLIC_URL}/anki/${filename}`;
    console.log(`✓ ${filename}`);
    console.log(`  Size: ${response.ContentLength} bytes`);
    console.log(`  Type: ${response.ContentType}`);
    console.log(`  URL: ${url}`);
    console.log('');
  } catch (error) {
    console.log(`✗ ${filename}: ${error.message}`);
  }
}
