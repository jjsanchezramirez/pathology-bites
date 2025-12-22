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

console.log('📝 Finding and fixing files with spaces in R2...\n');

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

console.log('Renaming files (replacing spaces with underscores)...\n');

let renamed = 0;
let failed = 0;
const mapping = [];

for (const oldKey of filesWithSpaces) {
  const newKey = oldKey.replace(/ /g, '_');
  const filename = oldKey.replace('anki/', '');
  const newFilename = newKey.replace('anki/', '');
  
  try {
    // Copy to new key
    await client.send(new CopyObjectCommand({
      Bucket: 'pathology-bites-images',
      CopySource: `pathology-bites-images/${oldKey}`,
      Key: newKey,
    }));
    
    // Delete old key
    await client.send(new DeleteObjectCommand({
      Bucket: 'pathology-bites-images',
      Key: oldKey,
    }));
    
    renamed++;
    mapping.push({ old: filename, new: newFilename });
    
    if (renamed % 50 === 0) {
      console.log(`  Renamed ${renamed}/${filesWithSpaces.length}...`);
    }
  } catch (error) {
    failed++;
    console.log(`  ✗ Failed to rename: ${filename}`);
  }
}

console.log(`\n==================================================`);
console.log(`Rename Complete`);
console.log(`==================================================`);
console.log(`Total files: ${filesWithSpaces.length}`);
console.log(`Renamed: ${renamed}`);
console.log(`Failed: ${failed}`);

// Save mapping for updating Anki JSON
writeFileSync('/tmp/r2-rename-mapping.json', JSON.stringify(mapping, null, 2));
console.log(`\n📄 Saved rename mapping to /tmp/r2-rename-mapping.json`);
console.log(`   Use this to update your Anki JSON file references`);
