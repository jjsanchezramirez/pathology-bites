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

console.log('Finding files with remaining spaces...\n');

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

console.log('Sample files:');
filesWithSpaces.slice(0, 5).forEach(f => console.log(`  - ${f}`));

console.log('\nFixing remaining spaces...\n');

let renamed = 0;
let failed = 0;

for (let i = 0; i < filesWithSpaces.length; i++) {
  const oldKey = filesWithSpaces[i];
  const newKey = oldKey.replace(/ /g, '_');
  
  try {
    const encodedSource = encodeURIComponent(`pathology-bites-images/${oldKey}`);
    
    await client.send(new CopyObjectCommand({
      Bucket: 'pathology-bites-images',
      CopySource: encodedSource,
      Key: newKey,
    }));
    
    await client.send(new DeleteObjectCommand({
      Bucket: 'pathology-bites-images',
      Key: oldKey,
    }));
    
    renamed++;
    
    if ((i + 1) % 20 === 0 || i === filesWithSpaces.length - 1) {
      console.log(`  Progress: ${renamed} renamed, ${failed} failed (${i + 1}/${filesWithSpaces.length})`);
    }
  } catch (error) {
    failed++;
    console.log(`  ✗ ${oldKey.replace('anki/', '')}: ${error.message}`);
  }
}

console.log(`\n✅ Fixed ${renamed} files, ${failed} failed`);
