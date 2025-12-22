#!/usr/bin/env node
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
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

console.log('Listing Screenshot files in R2...\n');

const response = await client.send(new ListObjectsV2Command({
  Bucket: 'pathology-bites-images',
  Prefix: 'anki/Screenshot_2025-11',
  MaxKeys: 10,
}));

if (response.Contents) {
  console.log(`Found ${response.Contents.length} files:\n`);
  response.Contents.forEach(obj => {
    console.log(`  ${obj.Key}`);
    console.log(`  Size: ${obj.Size} bytes`);
    console.log(`  Last Modified: ${obj.LastModified}`);
    console.log('');
  });
} else {
  console.log('No Screenshot files found');
}
