#!/usr/bin/env node
import { S3Client, ListObjectsV2Command, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
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

console.log('📝 Finding files with spaces in R2...\n');

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
        filesWithSpaces.push(obj.Key);
      }
    });
  }
  
  continuationToken = response.NextContinuationToken;
} while (continuationToken);

console.log(`Found ${filesWithSpaces.length} files with spaces\n`);

if (filesWithSpaces.length === 0) {
  console.log('✅ No files with spaces!');
  process.exit(0);
}

console.log('Copying files to new keys with underscores...\n');

let renamed = 0;
let failed = 0;
const mapping = [];
const failedFiles = [];

for (let i = 0; i < filesWithSpaces.length; i++) {
  const oldKey = filesWithSpaces[i];
  const newKey = oldKey.replace(/ /g, '_');
  const filename = oldKey.replace('anki/', '');
  const newFilename = newKey.replace('anki/', '');
  
  try {
    // Copy to new key - URL encode the source key
    const encodedSource = encodeURIComponent(`pathology-bites-images/${oldKey}`);
    
    await client.send(new CopyObjectCommand({
      Bucket: 'pathology-bites-images',
      CopySource: encodedSource,
      Key: newKey,
    }));
    
    // Delete old key
    await client.send(new DeleteObjectCommand({
      Bucket: 'pathology-bites-images',
      Key: oldKey,
    }));
    
    renamed++;
    mapping.push({ old: filename, new: newFilename });
    
    if ((i + 1) % 20 === 0 || i === filesWithSpaces.length - 1) {
      console.log(`  Progress: ${renamed} renamed, ${failed} failed (${i + 1}/${filesWithSpaces.length})`);
    }
  } catch (error) {
    failed++;
    failedFiles.push({ filename, error: error.message });
    console.log(`  ✗ ${filename}: ${error.message}`);
  }
}

console.log(`\n==================================================`);
console.log(`Rename Complete`);
console.log(`==================================================`);
console.log(`Total files: ${filesWithSpaces.length}`);
console.log(`Renamed: ${renamed}`);
console.log(`Failed: ${failed}`);

writeFileSync('/tmp/r2-rename-mapping.json', JSON.stringify(mapping, null, 2));
console.log(`\n📄 Saved rename mapping to /tmp/r2-rename-mapping.json`);

if (failed > 0) {
  writeFileSync('/tmp/r2-rename-failures.json', JSON.stringify(failedFiles, null, 2));
  console.log(`📄 Saved failures to /tmp/r2-rename-failures.json`);
}
