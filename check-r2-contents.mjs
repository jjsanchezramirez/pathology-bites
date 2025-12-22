#!/usr/bin/env node
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { readFileSync, writeFileSync } from 'fs';

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

console.log('Listing files in R2 bucket with prefix "anki/"...\n');

let continuationToken;
let totalFiles = 0;
let totalSize = 0;
const allFiles = [];

do {
  const command = new ListObjectsV2Command({
    Bucket: 'pathology-bites-images',
    Prefix: 'anki/',
    MaxKeys: 1000,
    ContinuationToken: continuationToken,
  });

  const response = await client.send(command);
  
  if (response.Contents) {
    totalFiles += response.Contents.length;
    response.Contents.forEach(obj => {
      totalSize += obj.Size || 0;
      // Store just the filename (remove anki/ prefix)
      const filename = obj.Key.replace('anki/', '');
      if (filename) allFiles.push(filename);
    });
  }
  
  continuationToken = response.NextContinuationToken;
  console.log(`Fetched ${response.Contents?.length || 0} files... (total: ${totalFiles})`);
} while (continuationToken);

console.log(`\nTotal files in anki/: ${totalFiles}`);
console.log(`Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

// Save list of existing files
writeFileSync('/tmp/r2-existing-files.txt', allFiles.join('\n'));
console.log(`\nSaved list to /tmp/r2-existing-files.txt`);
