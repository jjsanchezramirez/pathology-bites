#!/usr/bin/env node

/**
 * Automatically fix unused variable warnings by:
 * 1. Prefixing unused parameters with underscore
 * 2. Removing unused imports
 * 3. Removing unused type imports
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Get lint output in JSON format
console.log('Running ESLint to find unused variables...');
let lintOutput;
try {
  execSync('npm run lint -- --format json --output-file lint-results.json', { 
    stdio: 'inherit',
    cwd: process.cwd()
  });
} catch (_error) {
  // ESLint exits with error code when there are warnings, but still generates the file
}

const lintResults = JSON.parse(fs.readFileSync('lint-results.json', 'utf8'));

let totalFixed = 0;
const filesToFix = new Map();

// Collect all fixes grouped by file
for (const result of lintResults) {
  if (!result.messages.length) continue;
  
  const filePath = result.filePath;
  if (filePath.includes('dev/scripts')) continue; // Skip dev scripts
  
  const fixes = [];
  
  for (const message of result.messages) {
    if (message.ruleId === '@typescript-eslint/no-unused-vars') {
      fixes.push({
        line: message.line,
        column: message.column,
        message: message.message,
        endLine: message.endLine,
        endColumn: message.endColumn
      });
    }
  }
  
  if (fixes.length > 0) {
    filesToFix.set(filePath, fixes);
  }
}

console.log(`\nFound ${filesToFix.size} files with unused variables`);

// Process each file
for (const [filePath, fixes] of filesToFix) {
  const relativePath = path.relative(process.cwd(), filePath);
  console.log(`\nProcessing ${relativePath} (${fixes.length} issues)...`);
  
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  let modified = false;
  
  // Sort fixes by line number (descending) to avoid offset issues
  fixes.sort((a, b) => b.line - a.line);
  
  for (const fix of fixes) {
    const lineIndex = fix.line - 1;
    const line = lines[lineIndex];

    // Extract variable name from message
    const match = fix.message.match(/'([^']+)' is (defined|assigned)/);
    if (!match) continue;

    const varName = match[1];

    // Skip if already prefixed with underscore and still unused - these need manual review
    if (varName.startsWith('_')) {
      console.log(`  ⚠ Skipping ${varName} (already prefixed, needs manual review)`);
      continue;
    }
    
    // Pattern 1: Unused function parameter - prefix with underscore
    if (line.includes(`(`) && line.includes(varName)) {
      const newLine = line.replace(
        new RegExp(`\\b${varName}\\b(?=\\s*[,:\\)])`, 'g'),
        `_${varName}`
      );
      if (newLine !== line) {
        lines[lineIndex] = newLine;
        modified = true;
        totalFixed++;
        console.log(`  ✓ Prefixed parameter: ${varName} -> _${varName}`);
      }
    }
    
    // Pattern 2: Unused import - try to remove it
    else if (line.includes('import') && line.includes(varName)) {
      // Handle different import patterns
      if (line.match(new RegExp(`import\\s+{[^}]*\\b${varName}\\b[^}]*}\\s+from`))) {
        // Named import
        const newLine = line
          .replace(new RegExp(`\\b${varName}\\b,\\s*`, 'g'), '')
          .replace(new RegExp(`,\\s*\\b${varName}\\b`, 'g'), '')
          .replace(new RegExp(`{\\s*\\b${varName}\\b\\s*}`, 'g'), '{}');
        
        // If import is now empty, remove the entire line
        if (newLine.includes('{}')) {
          lines[lineIndex] = '';
          modified = true;
          totalFixed++;
          console.log(`  ✓ Removed import: ${varName}`);
        } else if (newLine !== line) {
          lines[lineIndex] = newLine;
          modified = true;
          totalFixed++;
          console.log(`  ✓ Removed from import: ${varName}`);
        }
      }
    }
    
    // Pattern 3: Unused destructured variable - prefix with underscore
    else if (line.includes('{') && line.includes(varName) && line.includes('}')) {
      const newLine = line.replace(
        new RegExp(`\\b${varName}\\b(?=\\s*[,}])`, 'g'),
        `_${varName}`
      );
      if (newLine !== line) {
        lines[lineIndex] = newLine;
        modified = true;
        totalFixed++;
        console.log(`  ✓ Prefixed destructured var: ${varName} -> _${varName}`);
      }
    }
  }
  
  if (modified) {
    fs.writeFileSync(filePath, lines.join('\n'));
    console.log(`  ✅ Fixed ${relativePath}`);
  }
}

// Clean up
fs.unlinkSync('lint-results.json');

console.log(`\n✅ Total fixes applied: ${totalFixed}`);
console.log('\nRunning build to verify...');

try {
  execSync('npm run build', { stdio: 'inherit' });
  console.log('\n✅ Build successful! All fixes are valid.');
} catch (_error) {
  console.error('\n❌ Build failed. Please review the changes.');
  process.exit(1);
}

