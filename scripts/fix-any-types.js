#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Get all explicit 'any' warnings from src/ directory only
const lintOutput = execSync('npm run lint 2>&1', { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });
const lines = lintOutput.split('\n');

const warnings = [];
let currentFile = null;

for (const line of lines) {
  // Match file path - only process files in src/
  if (line.match(/^\/.*\/src\/.*\.tsx?$/)) {
    currentFile = line.trim();
  }
  // Match no-explicit-any warning
  else if (line.includes('@typescript-eslint/no-explicit-any') && currentFile) {
    const match = line.match(/^\s*(\d+):(\d+)\s+warning/);
    if (match) {
      const [, lineNum, colNum] = match;
      warnings.push({
        file: currentFile,
        line: parseInt(lineNum),
        col: parseInt(colNum)
      });
    }
  }
}

console.log(`Found ${warnings.length} explicit 'any' warnings to fix in src/\n`);

// Group by file
const fileWarnings = new Map();
for (const warning of warnings) {
  if (!fileWarnings.has(warning.file)) {
    fileWarnings.set(warning.file, []);
  }
  fileWarnings.get(warning.file).push(warning);
}

let fixedCount = 0;
const fixedFiles = [];

for (const [filePath, warns] of fileWarnings) {
  if (!fs.existsSync(filePath)) continue;
  
  let content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  let modified = false;
  
  // Sort warnings by line number in reverse to avoid index shifting
  warns.sort((a, b) => b.line - a.line);
  
  for (const warning of warns) {
    const lineIndex = warning.line - 1;
    if (lineIndex >= lines.length) continue;
    
    let line = lines[lineIndex];
    const originalLine = line;
    
    // Skip if already fixed or no 'any' found
    if (!line.includes('any')) continue;
    
    // Pattern 1: as any (type assertion) - most common
    if (line.includes('as any')) {
      // Check for role-related contexts
      if (line.match(/role|Role|effectiveRole|userRole/i)) {
        line = line.replace(/as\s+any\b/g, 'as UserRole');
        // Check if import exists
        if (!content.includes("import { UserRole }") && !content.includes("import type { UserRole }")) {
          // Add import at the top
          const firstImportIndex = lines.findIndex(l => l.trim().startsWith('import '));
          if (firstImportIndex >= 0) {
            lines.splice(firstImportIndex, 0, "import { UserRole } from '@/shared/utils/auth-helpers'");
          }
        }
      } else {
        line = line.replace(/as\s+any\b/g, 'as unknown');
      }
    }
    // Pattern 2: : any (type annotation)
    else if (line.match(/:\s*any\b/)) {
      // Check for supabase parameter
      if (line.match(/supabase:\s*any/)) {
        line = line.replace(/:\s*any\b/g, ': SupabaseClient');
        // Check if import exists
        if (!content.includes("import") || !content.includes("SupabaseClient")) {
          const firstImportIndex = lines.findIndex(l => l.trim().startsWith('import '));
          if (firstImportIndex >= 0) {
            lines.splice(firstImportIndex, 0, "import type { SupabaseClient } from '@supabase/supabase-js'");
          }
        }
      } else {
        line = line.replace(/:\s*any\b/g, ': unknown');
      }
    }
    // Pattern 3: <any>
    else if (line.includes('<any>')) {
      line = line.replace(/<any>/g, '<unknown>');
    }
    // Pattern 4: any[]
    else if (line.includes('any[]')) {
      line = line.replace(/any\[\]/g, 'unknown[]');
    }
    // Pattern 5: Array<any>
    else if (line.includes('Array<any>')) {
      line = line.replace(/Array<any>/g, 'Array<unknown>');
    }
    // Pattern 6: Record<string, any>
    else if (line.match(/Record<[^,]+,\s*any>/)) {
      line = line.replace(/Record<([^,]+),\s*any>/g, 'Record<$1, unknown>');
    }
    
    if (line !== originalLine) {
      lines[lineIndex] = line;
      modified = true;
      fixedCount++;
    }
  }
  
  if (modified) {
    fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
    const relativePath = path.relative(process.cwd(), filePath);
    fixedFiles.push(relativePath);
    console.log(`✓ Fixed ${relativePath}`);
  }
}

console.log(`\n✅ Fixed ${fixedCount} explicit 'any' warnings in ${fixedFiles.length} files`);

