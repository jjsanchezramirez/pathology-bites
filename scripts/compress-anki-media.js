#!/usr/bin/env node
/**
 * Compress Anki media files using the same algorithm as admin/images
 * This achieves 90%+ compression while maintaining quality
 *
 * Algorithm from src/features/images/services/image-upload.ts:
 * - Target: 1MB per file (adjustable)
 * - Start at 80% quality, reduce by 5% until target met or 60% reached
 * - Max dimensions: 2048x2048px
 * - Format preservation: PNG stays PNG, JPG stays JPG
 *
 * Usage: node scripts/compress-anki-media.js
 */

const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

const COMPRESSION_CONFIG = {
  targetSizeBytes: 300 * 1024,    // 300KB target per file (AGGRESSIVE!)
  maxWidth: 1200,                 // 1200x1200 max dimensions
  maxHeight: 1200,
  qualityStart: 80,               // Start at 80% quality
  qualityMin: 50,                 // Go down to 50% if needed (aggressive)
  qualityStep: 5,                 // Reduce by 5% each iteration
  jpeg: {
    progressive: true,
    mozjpeg: true
  },
  png: {
    compressionLevel: 9,
    progressive: true
  }
};

const MEDIA_DIR = path.join(process.cwd(), 'anki', 'media');

/**
 * Recursively compress an image until it meets the target size
 * This is the same algorithm used in admin/images that achieves 90%+ compression
 */
async function compressImageRecursively(filePath, quality = COMPRESSION_CONFIG.qualityStart) {
  const ext = path.extname(filePath).toLowerCase();
  const filename = path.basename(filePath);
  const originalStats = await fs.stat(filePath);
  const originalSize = originalStats.size;

  // Skip SVG and GIF (already optimal or need special handling)
  if (ext === '.svg' || ext === '.gif') {
    return { filename, originalSize, compressedSize: originalSize, skipped: true, reason: 'format' };
  }

  // Skip non-image files
  if (!['.png', '.jpg', '.jpeg', '.jpglarge', '.png_m'].includes(ext)) {
    return { filename, originalSize, compressedSize: originalSize, skipped: true, reason: 'format' };
  }

  try {
    let pipeline = sharp(filePath);
    const metadata = await pipeline.metadata();

    // Resize if needed (same as admin/images)
    let resized = false;
    if (metadata.width > COMPRESSION_CONFIG.maxWidth || metadata.height > COMPRESSION_CONFIG.maxHeight) {
      pipeline = pipeline.resize(COMPRESSION_CONFIG.maxWidth, COMPRESSION_CONFIG.maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      });
      resized = true;
    }

    // Compress based on format (CRITICAL: keep original format for JSON compatibility!)
    let compressed;
    if (ext === '.png' || ext === '.png_m') {
      // PNG compression with quality setting
      compressed = await pipeline
        .png({
          quality: quality,
          compressionLevel: COMPRESSION_CONFIG.png.compressionLevel,
          progressive: COMPRESSION_CONFIG.png.progressive
        })
        .toBuffer();
    } else {
      // JPEG compression with quality setting
      compressed = await pipeline
        .jpeg({
          quality: quality,
          progressive: COMPRESSION_CONFIG.jpeg.progressive,
          mozjpeg: COMPRESSION_CONFIG.jpeg.mozjpeg
        })
        .toBuffer();
    }

    const compressionRatio = compressed.length / originalSize;
    const savings = ((1 - compressionRatio) * 100).toFixed(1);

    // Check if we achieved the target size
    if (compressed.length <= COMPRESSION_CONFIG.targetSizeBytes) {
      // Success! Write the compressed file
      if (compressed.length < originalSize) {
        await fs.writeFile(filePath, compressed);
        return {
          filename,
          originalSize,
          compressedSize: compressed.length,
          skipped: false,
          resized,
          savings,
          quality
        };
      } else {
        // Compressed is larger than original, keep original
        return { filename, originalSize, compressedSize: originalSize, skipped: true, reason: 'larger' };
      }
    } else {
      // File is still too large, try reducing quality
      if (quality > COMPRESSION_CONFIG.qualityMin) {
        const newQuality = Math.max(COMPRESSION_CONFIG.qualityMin, quality - COMPRESSION_CONFIG.qualityStep);
        // Recursively try with lower quality
        return await compressImageRecursively(filePath, newQuality);
      } else {
        // We've reached minimum quality, accept this result if it's smaller than original
        if (compressed.length < originalSize) {
          await fs.writeFile(filePath, compressed);
          return {
            filename,
            originalSize,
            compressedSize: compressed.length,
            skipped: false,
            resized,
            savings,
            quality,
            oversized: true  // Flag that it's still over target
          };
        } else {
          // Even at minimum quality, compressed is larger, keep original
          return { filename, originalSize, compressedSize: originalSize, skipped: true, reason: 'larger' };
        }
      }
    }
  } catch (error) {
    console.error(`  ❌ ${filename}: ${error.message}`);
    return { filename, originalSize, compressedSize: originalSize, skipped: true, error: true };
  }
}

async function main() {
  console.log('🎴 Anki Media Compression (Admin/Images Algorithm)');
  console.log('====================================================\n');

  // Check if directory exists
  try {
    await fs.access(MEDIA_DIR);
  } catch {
    console.error(`❌ Directory not found: ${MEDIA_DIR}`);
    console.error('\nPlease ensure you have:');
    console.error('  1. Exported from Anki using CrowdAnki');
    console.error('  2. Placed the export in the anki/ directory');
    process.exit(1);
  }

  // Read directory
  const files = await fs.readdir(MEDIA_DIR);
  const imageFiles = files.filter(f => {
    const ext = path.extname(f).toLowerCase();
    return ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.jpglarge', '.png_m'].includes(ext);
  });

  console.log(`📊 Found ${imageFiles.length} media files in anki/media/\n`);
  console.log('Algorithm (AGGRESSIVE - 300KB target):');
  console.log(`  • Target size: ${(COMPRESSION_CONFIG.targetSizeBytes / 1024).toFixed(0)} KB per file`);
  console.log(`  • Max dimensions: ${COMPRESSION_CONFIG.maxWidth}x${COMPRESSION_CONFIG.maxHeight}px`);
  console.log(`  • Quality range: ${COMPRESSION_CONFIG.qualityStart}% → ${COMPRESSION_CONFIG.qualityMin}% (adaptive)`);
  console.log(`  • Format conversion: NO (PNG stays PNG, JPG stays JPG)`);
  console.log(`  • Strategy: Reduce quality by ${COMPRESSION_CONFIG.qualityStep}% until target met\n`);
  console.log('🔄 Compressing...\n');

  let totalOriginal = 0;
  let totalCompressed = 0;
  let processedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  let resizedCount = 0;
  let oversizedCount = 0;

  const startTime = Date.now();

  for (let i = 0; i < imageFiles.length; i++) {
    const file = imageFiles[i];
    const filePath = path.join(MEDIA_DIR, file);
    const result = await compressImageRecursively(filePath);

    totalOriginal += result.originalSize;
    totalCompressed += result.compressedSize;

    if (result.error) {
      errorCount++;
    } else if (result.skipped) {
      skippedCount++;
    } else {
      processedCount++;
      if (result.resized) resizedCount++;
      if (result.oversized) oversizedCount++;

      // Log every 50 files or significant compression or oversized files
      if (processedCount % 50 === 0 || parseFloat(result.savings) > 80 || result.oversized) {
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = (i + 1) / elapsed;
        const eta = (imageFiles.length - i - 1) / rate;
        const oversizedFlag = result.oversized ? ' ⚠️ >300KB' : '';
        console.log(
          `  [${i + 1}/${imageFiles.length}] ${result.filename}: ` +
          `${(result.originalSize / 1024).toFixed(1)} KB → ${(result.compressedSize / 1024).toFixed(1)} KB ` +
          `(${result.savings}% saved, Q:${result.quality}%) - ${rate.toFixed(1)} f/s, ETA: ${Math.round(eta)}s${oversizedFlag}`
        );
      }
    }
  }

  const duration = (Date.now() - startTime) / 1000;
  const overallRatio = totalCompressed / totalOriginal;
  const overallSavings = ((1 - overallRatio) * 100).toFixed(1);

  console.log('\n================================');
  console.log('✅ Compression Complete');
  console.log('================================\n');
  console.log('📊 Summary:');
  console.log(`   Files processed: ${processedCount}`);
  console.log(`   Files skipped: ${skippedCount}`);
  console.log(`   Files resized: ${resizedCount}`);
  console.log(`   Files still >300KB: ${oversizedCount}`);
  if (errorCount > 0) {
    console.log(`   Errors: ${errorCount}`);
  }
  console.log(`   Original size: ${(totalOriginal / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Compressed size: ${(totalCompressed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Total savings: ${overallSavings}%`);
  console.log(`   Duration: ${Math.round(duration)}s`);
  console.log(`   Speed: ${(imageFiles.length / duration).toFixed(1)} files/sec`);
  console.log('');

  // Check if we hit the 0.5 GB target
  const targetGB = 0.5;
  const actualGB = totalCompressed / 1024 / 1024 / 1024;
  if (actualGB <= targetGB) {
    console.log(`🎉 SUCCESS! Total size ${actualGB.toFixed(2)} GB is within ${targetGB} GB target!`);
  } else {
    console.log(`⚠️  Total size ${actualGB.toFixed(2)} GB exceeds ${targetGB} GB target by ${((actualGB - targetGB) * 1024).toFixed(0)} MB`);
    console.log(`   ${oversizedCount} files are still over 300KB each`);
  }
  console.log('');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
