#!/usr/bin/env node
import { S3Client, ListObjectsV2Command, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
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

console.log('Finding files with spaces in anki/ prefix...\n');

let continuationToken;
const filesWithSpaces = [];

do {
  const command = new ListObjectsV2Command({
    Bucket: 'pathology-bites-images',
    Prefix: 'anki/',
    MaxKeys: 1000,
    ContinuationToken: continuationToken,
  });

  const response = await client.send(command);
  
  if (response.Contents) {
    response.Contents.forEach(obj => {
      if (obj.Key && obj.Key.includes(' ')) {
        const filename = obj.Key.replace('anki/', '');
        filesWithSpaces.push({ key: obj.Key, filename });
      }
    });
  }
  
  continuationToken = response.NextContinuationToken;
} while (continuationToken);

console.log(`Found ${filesWithSpaces.length} files with spaces\n`);

if (filesWithSpaces.length === 0) {
  console.log('✅ No files with spaces found!');
  process.exit(0);
}

console.log('Sample files:');
filesWithSpaces.slice(0, 5).forEach(f => console.log(`  - ${f.filename}`));

console.log('\nOptions to fix:');
console.log('1. URL encode spaces as %20 when accessing (recommended - no changes needed)');
console.log('2. Copy files to new keys with underscores instead of spaces');
console.log('3. Download and re-upload with sanitized names');
console.log('\nFor now, you can access these files by URL-encoding the spaces:');
console.log(`Example: https://pub-a4bec7073d99465f99043c842be6318c.r2.dev/anki/${encodeURIComponent(filesWithSpaces[0].filename)}`);
