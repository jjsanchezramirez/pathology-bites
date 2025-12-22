#!/usr/bin/env node
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { readFileSync, writeFileSync } from 'fs';

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

console.log('Checking R2 for files with spaces...\n');

let continuationToken;
const filesWithSpaces = [];
const allFiles = [];

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
        allFiles.push(obj.Key);
        if (obj.Key.includes(' ')) {
          filesWithSpaces.push(obj.Key);
        }
      }
    });
  }

  continuationToken = response.NextContinuationToken;
} while (continuationToken);

console.log(`Total files in anki/: ${allFiles.length}`);
console.log(`Files with spaces: ${filesWithSpaces.length}\n`);

if (filesWithSpaces.length > 0) {
  console.log('Sample files with spaces:');
  filesWithSpaces.slice(0, 10).forEach(f => console.log(`  - ${f}`));

  console.log(`\nAll ${filesWithSpaces.length} files with spaces saved to /tmp/r2-files-with-spaces.txt`);
  writeFileSync('/tmp/r2-files-with-spaces.txt', filesWithSpaces.join('\n'));
} else {
  console.log('✅ No files with spaces found in R2!');
}
