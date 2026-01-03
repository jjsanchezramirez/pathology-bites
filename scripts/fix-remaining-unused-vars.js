#!/usr/bin/env node

/**
 * Fix remaining unused variables by:
 * 1. Removing unused imports
 * 2. Removing unused type definitions
 * 3. Prefixing unused destructured variables with _
 * 4. Removing unused function parameters (when safe)
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

// Parse unused vars warnings
const warnings = [];
const lines = lintOutput.split('\n');
let currentFile = '';

for (const line of lines) {
  // Track current file
  if (line.match(/^\/.*\.tsx?$/)) {
    currentFile = line.trim();
    continue;
  }

  // Parse warning line
  const warningMatch = line.match(/^\s+(\d+):(\d+)\s+warning\s+'([^']+)' is (?:defined but never used|assigned a value but never used)/);
  if (warningMatch && currentFile) {
    const [, lineNum, col, varName] = warningMatch;

    // Skip dev/scripts
    if (currentFile.includes('/dev/scripts/')) continue;

    warnings.push({
      file: currentFile,
      line: parseInt(lineNum),
      col: parseInt(col),
      varName
    });
  }
}

console.log(`Found ${warnings.length} unused variable warnings to fix`);

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

  warns.forEach(({ line, varName }) => {
    const lineIndex = line - 1;
    if (lineIndex >= lines.length) return;
    
    const lineContent = lines[lineIndex];
    
    // Pattern 1: Unused imports - remove entire import
    if (lineContent.includes('import') && lineContent.includes(varName)) {
      // Check if it's a single import
      const singleImportPattern = new RegExp(`^import\\s+${varName}\\s+from`);
      if (singleImportPattern.test(lineContent.trim())) {
        lines[lineIndex] = '';
        modified = true;
        totalFixed++;
        return;
      }
      
      // Remove from multi-import
      const namedImportPattern = new RegExp(`\\b${varName}\\b,?\\s*`);
      if (lineContent.includes('{') && lineContent.includes(varName)) {
        let newLine = lineContent.replace(namedImportPattern, '');
        // Clean up extra commas
        newLine = newLine.replace(/,\s*,/g, ',').replace(/{\s*,/g, '{').replace(/,\s*}/g, '}');
        // Remove empty imports
        if (newLine.match(/{\s*}/)) {
          lines[lineIndex] = '';
        } else {
          lines[lineIndex] = newLine;
        }
        modified = true;
        totalFixed++;
        return;
      }
    }
    
    // Pattern 2: Unused type/interface definitions - remove
    if (lineContent.match(new RegExp(`^\\s*(type|interface)\\s+${varName}\\b`))) {
      // Find the end of the type definition
      let endLine = lineIndex;
      let braceCount = 0;
      let inDefinition = false;
      
      for (let i = lineIndex; i < lines.length; i++) {
        const l = lines[i];
        if (l.includes('{')) {
          braceCount += (l.match(/{/g) || []).length;
          inDefinition = true;
        }
        if (l.includes('}')) {
          braceCount -= (l.match(/}/g) || []).length;
        }
        
        if (inDefinition && braceCount === 0) {
          endLine = i;
          break;
        }
        
        // Single-line type
        if (!inDefinition && (l.includes('=') || l.includes('extends')) && l.trim().endsWith(';')) {
          endLine = i;
          break;
        }
      }
      
      // Remove the type definition
      for (let i = lineIndex; i <= endLine; i++) {
        lines[i] = '';
      }
      modified = true;
      totalFixed++;
      return;
    }
    
    // Pattern 3: Unused destructured variables - prefix with _
    if (lineContent.includes('const') && lineContent.includes('{') && !varName.startsWith('_')) {
      const destructurePattern = new RegExp(`\\b${varName}\\b`);
      if (destructurePattern.test(lineContent)) {
        lines[lineIndex] = lineContent.replace(
          new RegExp(`\\b${varName}\\b`),
          `_${varName}`
        );
        modified = true;
        totalFixed++;
        return;
      }
    }
    
    // Pattern 4: Unused function parameters - prefix with _
    if ((lineContent.includes('function') || lineContent.includes('=>') || lineContent.includes('(')) && 
        !varName.startsWith('_')) {
      const paramPattern = new RegExp(`\\b${varName}\\b`);
      if (paramPattern.test(lineContent)) {
        lines[lineIndex] = lineContent.replace(
          new RegExp(`\\b${varName}\\b`),
          `_${varName}`
        );
        modified = true;
        totalFixed++;
      }
    }
  });

  if (modified) {
    const newContent = lines.join('\n');
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`✓ Fixed ${filePath}`);
  }
});

console.log(`\n✅ Fixed ${totalFixed} unused variable warnings`);

