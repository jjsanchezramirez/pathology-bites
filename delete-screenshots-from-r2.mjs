#!/usr/bin/env node
import { S3Client, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
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

console.log('🔍 Finding all Screenshot files in R2...\n');

let continuationToken;
const screenshotFiles = [];

do {
  const response = await client.send(new ListObjectsV2Command({
    Bucket: 'pathology-bites-images',
    Prefix: 'anki/',
    MaxKeys: 1000,
    ContinuationToken: continuationToken,
  }));

  if (response.Contents) {
    response.Contents.forEach(obj => {
      if (obj.Key) {
        const filename = obj.Key.replace('anki/', '');
        if (filename.startsWith('Screenshot')) {
          screenshotFiles.push(obj.Key);
        }
      }
    });
  }

  continuationToken = response.NextContinuationToken;
} while (continuationToken);

console.log(`Found ${screenshotFiles.length} Screenshot files to delete\n`);

if (screenshotFiles.length === 0) {
  console.log('✅ No Screenshot files found in R2');
  process.exit(0);
}

console.log('Sample files to be deleted:');
screenshotFiles.slice(0, 5).forEach(f => console.log(`  - ${f}`));
console.log('');

console.log('🗑️  Deleting Screenshot files...\n');

let deleted = 0;
let failed = 0;
const BATCH_SIZE = 10;

for (let i = 0; i < screenshotFiles.length; i += BATCH_SIZE) {
  const batch = screenshotFiles.slice(i, i + BATCH_SIZE);

  const results = await Promise.allSettled(
    batch.map(key => client.send(new DeleteObjectCommand({
      Bucket: 'pathology-bites-images',
      Key: key,
    })))
  );

  results.forEach((result, idx) => {
    const key = batch[idx];
    if (result.status === 'fulfilled') {
      deleted++;
      console.log(`  ✓ Deleted: ${key}`);
    } else {
      failed++;
      console.log(`  ✗ Failed: ${key}: ${result.reason.message}`);
    }
  });
}

console.log('\n==================================================');
console.log('Deletion Complete');
console.log('==================================================');
console.log(`Total files: ${screenshotFiles.length}`);
console.log(`Deleted: ${deleted}`);
console.log(`Failed: ${failed}`);

if (failed === 0) {
  console.log('\n✅ All Screenshot files deleted successfully!');
} else {
  console.log(`\n⚠️  ${failed} files failed to delete`);
}
