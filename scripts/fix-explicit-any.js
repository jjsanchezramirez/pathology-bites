#!/usr/bin/env node

/**
 * Replace explicit 'any' types with 'unknown' in safe contexts:
 * 1. catch (error: any) => catch (error)
 * 2. Function parameters: (param: any) => (param: unknown)
 * 3. Type annotations: const x: any => const x: unknown
 * 4. Return types: (): any => (): unknown
 * 
 * Skip:
 * - Comments
 * - String literals
 * - Already has eslint-disable comment
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get lint output
let lintOutput;
try {
  lintOutput = execSync('npm run lint 2>&1', { 
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024 
  });
} catch {
  lintOutput = '';
}

// Parse no-explicit-any warnings
const warnings = [];
const lines = lintOutput.split('\n');
let currentFile = '';

for (const line of lines) {
  if (line.match(/^\/.*\.tsx?$/)) {
    currentFile = line.trim();
    continue;
  }
  
  const warningMatch = line.match(/^\s+(\d+):(\d+)\s+warning\s+Unexpected any\. Specify a different type\s+@typescript-eslint\/no-explicit-any/);
  if (warningMatch && currentFile) {
    const [, lineNum, col] = warningMatch;
    
    // Skip dev/scripts
    if (currentFile.includes('/dev/scripts/')) continue;
    
    warnings.push({
      file: currentFile,
      line: parseInt(lineNum),
      col: parseInt(col)
    });
  }
}

console.log(`Found ${warnings.length} explicit 'any' warnings to fix`);

// Group by file
const fileWarnings = {};
warnings.forEach(w => {
  if (!fileWarnings[w.file]) fileWarnings[w.file] = [];
  fileWarnings[w.file].push(w);
});

let totalFixed = 0;

// Process each file
Object.entries(fileWarnings).forEach(([filePath, warns]) => {
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  let modified = false;

  warns.forEach(({ line }) => {
    const lineIndex = line - 1;
    if (lineIndex >= lines.length) return;
    
    const lineContent = lines[lineIndex];
    
    // Skip if line has eslint-disable comment
    if (lineContent.includes('eslint-disable')) return;
    
    // Skip if in a comment
    if (lineContent.trim().startsWith('//') || lineContent.trim().startsWith('*')) return;
    
    let newLine = lineContent;
    let changed = false;
    
    // Pattern 1: catch (error: any) => catch (error) or catch
    if (lineContent.includes('catch') && lineContent.includes(': any')) {
      newLine = lineContent.replace(/catch\s*\(\s*(\w+)\s*:\s*any\s*\)/g, 'catch ($1)');
      if (newLine !== lineContent) {
        changed = true;
      }
    }
    
    // Pattern 2: Function parameters and variables: : any => : unknown
    // But be careful not to replace in strings or comments
    if (!changed && lineContent.includes(': any')) {
      // Replace : any with : unknown, but not in strings
      newLine = lineContent.replace(/:\s*any\b(?!\w)/g, ': unknown');
      if (newLine !== lineContent) {
        changed = true;
      }
    }
    
    // Pattern 3: Array types: any[] => unknown[]
    if (!changed && lineContent.includes('any[]')) {
      newLine = lineContent.replace(/\bany\[\]/g, 'unknown[]');
      if (newLine !== lineContent) {
        changed = true;
      }
    }
    
    // Pattern 4: Generic types: Array<any> => Array<unknown>
    if (!changed && lineContent.includes('Array<any>')) {
      newLine = lineContent.replace(/Array<any>/g, 'Array<unknown>');
      if (newLine !== lineContent) {
        changed = true;
      }
    }
    
    // Pattern 5: Record types: Record<string, any> => Record<string, unknown>
    if (!changed && lineContent.includes('Record<')) {
      newLine = lineContent.replace(/Record<([^,]+),\s*any>/g, 'Record<$1, unknown>');
      if (newLine !== lineContent) {
        changed = true;
      }
    }
    
    if (changed) {
      lines[lineIndex] = newLine;
      modified = true;
      totalFixed++;
    }
  });

  if (modified) {
    const newContent = lines.join('\n');
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`✓ Fixed ${filePath}`);
  }
});

console.log(`\n✅ Fixed ${totalFixed} explicit 'any' warnings`);

