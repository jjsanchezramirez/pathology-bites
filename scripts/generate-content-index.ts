/**
 * Script to generate a TypeScript index of lesson/topic mappings from R2 content files
 * This eliminates the need to fetch R2 files just to display subject information
 *
 * Run with: npx tsx scripts/generate-content-index.ts
 *
 * WHEN TO REGENERATE:
 * - After adding new content files to R2 storage
 * - After modifying lesson/topic keys in existing content files
 * - After adding new entries to CONTENT_FILES array in content-selector.tsx
 */

import { writeFileSync } from 'fs';
import { join } from 'path';

interface ContentFile {
  filename: string;
  category: string;
  subject: string;
}

interface ContentData {
  category: string;
  subject: {
    name: string;
    url: string;
    lessons: Record<string, {
      name: string;
      url: string;
      topics: Record<string, {
        name: string;
        url: string;
        content: unknown;
      }>;
    }>;
  };
}

interface FileMetadata {
  category: string;
  subject: string;
  filename: string;
}

interface CompactIndex {
  files: FileMetadata[];
  map: Record<string, number>; // "lesson::topic" -> file index
}

const CONTENT_FILES: ContentFile[] = [
  // Anatomic Pathology files
  { filename: "ap-bone.json", category: "Anatomic Pathology", subject: "Bone" },
  { filename: "ap-breast.json", category: "Anatomic Pathology", subject: "Breast" },
  { filename: "ap-cardiovascular-and-thoracic.json", category: "Anatomic Pathology", subject: "Cardiovascular and Thoracic" },
  { filename: "ap-cytopathology.json", category: "Anatomic Pathology", subject: "Cytopathology" },
  { filename: "ap-dermatopathology.json", category: "Anatomic Pathology", subject: "Dermatopathology" },
  { filename: "ap-forensics-and-autopsy.json", category: "Anatomic Pathology", subject: "Forensics and Autopsy" },
  { filename: "ap-gastrointestinal.json", category: "Anatomic Pathology", subject: "Gastrointestinal" },
  { filename: "ap-general-topics.json", category: "Anatomic Pathology", subject: "General Topics" },
  { filename: "ap-genitourinary.json", category: "Anatomic Pathology", subject: "Genitourinary" },
  { filename: "ap-gynecological.json", category: "Anatomic Pathology", subject: "Gynecological" },
  { filename: "ap-head-and-neck---endocrine.json", category: "Anatomic Pathology", subject: "Head and Neck / Endocrine" },
  { filename: "ap-hematopathology.json", category: "Anatomic Pathology", subject: "Hematopathology" },
  { filename: "ap-molecular.json", category: "Anatomic Pathology", subject: "Molecular" },
  { filename: "ap-neuropathology.json", category: "Anatomic Pathology", subject: "Neuropathology" },
  { filename: "ap-pancreas-biliary-liver.json", category: "Anatomic Pathology", subject: "Pancreas Biliary Liver" },
  { filename: "ap-pediatrics.json", category: "Anatomic Pathology", subject: "Pediatrics" },
  { filename: "ap-soft-tissue.json", category: "Anatomic Pathology", subject: "Soft Tissue" },

  // Clinical Pathology files
  { filename: "cp-clinical-chemistry.json", category: "Clinical Pathology", subject: "Clinical Chemistry" },
  { filename: "cp-hematology-hemostasis-and-thrombosis.json", category: "Clinical Pathology", subject: "Hematology Hemostasis and Thrombosis" },
  { filename: "cp-hematopathology.json", category: "Clinical Pathology", subject: "Hematopathology" },
  { filename: "cp-immunology.json", category: "Clinical Pathology", subject: "Immunology" },
  { filename: "cp-laboratory-management-and-clinical-laboratory-informatics.json", category: "Clinical Pathology", subject: "Laboratory Management and Clinical Laboratory Informatics" },
  { filename: "cp-medical-microbiology.json", category: "Clinical Pathology", subject: "Medical Microbiology" },
  { filename: "cp-molecular-pathology-and-cytogenetics.json", category: "Clinical Pathology", subject: "Molecular Pathology and Cytogenetics" },
  { filename: "cp-toxicology-body-fluids-and-special-techniques.json", category: "Clinical Pathology", subject: "Toxicology Body Fluids and Special Techniques" },
  { filename: "cp-transfusion-medicine.json", category: "Clinical Pathology", subject: "Transfusion Medicine" },
];

async function loadContentFromR2(filename: string): Promise<ContentData | null> {
  try {
    const response = await fetch(
      `https://pub-cee35549242c4118a1e03da0d07182d3.r2.dev/context/${filename}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );

    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.error(`Error loading ${filename}:`, error);
  }

  return null;
}

async function generateIndex() {
  console.log('🔍 Fetching all content files from R2...\n');

  const files: FileMetadata[] = [];
  const fileIndexMap = new Map<string, number>(); // filename -> index in files array
  const lessonTopicMap: Record<string, number> = {};

  for (const file of CONTENT_FILES) {
    console.log(`  Fetching ${file.filename}...`);
    const contentData = await loadContentFromR2(file.filename);

    if (!contentData) {
      console.error(`  ❌ Failed to load ${file.filename}`);
      continue;
    }

    // Add file metadata to array if not already present
    if (!fileIndexMap.has(file.filename)) {
      const fileIndex = files.length;
      files.push({
        category: file.category,
        subject: file.subject,
        filename: file.filename,
      });
      fileIndexMap.set(file.filename, fileIndex);
    }

    const fileIndex = fileIndexMap.get(file.filename)!;

    // Index all lessons and topics from this file
    let lessonCount = 0;
    let topicCount = 0;

    for (const [lessonKey, lesson] of Object.entries(contentData.subject.lessons)) {
      lessonCount++;

      for (const [topicKey] of Object.entries(lesson.topics)) {
        // Create compound key: "lesson::topic"
        const key = `${lessonKey}::${topicKey}`;
        lessonTopicMap[key] = fileIndex;
        topicCount++;
      }
    }

    console.log(`  ✓ Indexed ${lessonCount} lessons, ${topicCount} topics`);
  }

  const index: CompactIndex = {
    files,
    map: lessonTopicMap,
  };

  console.log('\n📝 Generating TypeScript file...\n');

  // Generate TypeScript file content
  const tsContent = `/**
 * Auto-generated index of lesson/topic mappings to content files
 * Generated by: scripts/generate-content-index.ts
 * Generated at: ${new Date().toISOString()}
 *
 * DO NOT EDIT THIS FILE MANUALLY
 * To regenerate, run: npx tsx scripts/generate-content-index.ts
 *
 * This uses a compact structure:
 * - files: Array of unique file metadata (26 files)
 * - map: Lesson::Topic -> file index (2,491 mappings)
 * - Total size: ~100KB (vs 440KB with nested structure)
 */

export interface ContentFileInfo {
  category: string;
  subject: string;
  filename: string;
}

// Unique file metadata array
const FILES: ContentFileInfo[] = ${JSON.stringify(index.files, null, 2)};

// Compact mapping: "lesson::topic" -> file index
const MAP: Record<string, number> = ${JSON.stringify(index.map, null, 2)};

/**
 * Quick lookup function to find content file info by lesson and topic
 */
export function getContentFileInfo(
  lessonKey: string,
  topicKey: string
): ContentFileInfo | null {
  const key = \`\${lessonKey}::\${topicKey}\`;
  const fileIndex = MAP[key];
  return fileIndex !== undefined ? FILES[fileIndex] : null;
}
`;

  // Write to file
  const outputPath = join(process.cwd(), 'src/shared/data/content-index.ts');
  writeFileSync(outputPath, tsContent, 'utf-8');

  console.log(`✅ Successfully generated: ${outputPath}`);
  console.log(`\n📊 Statistics:`);
  console.log(`   - Unique files: ${index.files.length}`);
  console.log(`   - Total mappings: ${Object.keys(index.map).length}`);
}

generateIndex().catch(console.error);
