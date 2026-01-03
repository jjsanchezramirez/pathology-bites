#!/usr/bin/env node

/**
 * Fix simple ESLint warnings:
 * 1. Unused error variables in catch blocks -> prefix with _
 * 2. prefer-const violations -> change let to const
 * 3. Remove unused imports that are clearly safe to remove
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Running ESLint to find simple fixable warnings...');
try {
  execSync('npm run lint -- --format json --output-file lint-results.json', { 
    stdio: 'inherit',
    cwd: process.cwd()
  });
} catch {
  // ESLint exits with error code when there are warnings
}

const lintResults = JSON.parse(fs.readFileSync('lint-results.json', 'utf8'));

let totalFixed = 0;
const filesToFix = new Map();

// Collect all fixes grouped by file
for (const result of lintResults) {
  if (!result.messages.length) continue;
  
  const filePath = result.filePath;
  if (filePath.includes('dev/scripts')) continue;
  
  const fixes = [];
  
  for (const message of result.messages) {
    if (message.ruleId === '@typescript-eslint/no-unused-vars' ||
        message.ruleId === 'prefer-const') {
      fixes.push({
        line: message.line,
        column: message.column,
        message: message.message,
        ruleId: message.ruleId
      });
    }
  }
  
  if (fixes.length > 0) {
    filesToFix.set(filePath, fixes);
  }
}

console.log(`\nFound ${filesToFix.size} files with fixable warnings`);

// Process each file
for (const [filePath, fixes] of filesToFix) {
  const relativePath = path.relative(process.cwd(), filePath);
  
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  let modified = false;
  
  // Sort fixes by line number (descending) to avoid offset issues
  fixes.sort((a, b) => b.line - a.line);
  
  for (const fix of fixes) {
    const lineIndex = fix.line - 1;
    const line = lines[lineIndex];
    
    if (fix.ruleId === 'prefer-const') {
      // Extract variable name from message
      const match = fix.message.match(/'([^']+)' is never reassigned/);
      if (!match) continue;
      
      const varName = match[1];
      
      // Change let to const
      const newLine = line.replace(
        new RegExp(`\\blet\\s+(${varName}\\b)`),
        'const $1'
      );
      
      if (newLine !== line) {
        lines[lineIndex] = newLine;
        modified = true;
        totalFixed++;
        console.log(`  ✓ ${relativePath}:${fix.line} - Changed let to const: ${varName}`);
      }
    }
    
    if (fix.ruleId === '@typescript-eslint/no-unused-vars') {
      const match = fix.message.match(/'([^']+)' is (defined|assigned)/);
      if (!match) continue;
      
      const varName = match[1];
      
      // Skip if already prefixed
      if (varName.startsWith('_')) continue;
      
      // Pattern: catch (error) -> catch (_error)
      if (line.includes('catch') && line.includes(varName)) {
        const newLine = line.replace(
          new RegExp(`catch\\s*\\(\\s*${varName}\\s*\\)`),
          `catch (_${varName})`
        );
        
        if (newLine !== line) {
          lines[lineIndex] = newLine;
          modified = true;
          totalFixed++;
          console.log(`  ✓ ${relativePath}:${fix.line} - Prefixed catch param: ${varName}`);
        }
      }
      
      // Pattern: Unused imports like CopyObjectCommand, DeleteObjectCommand
      else if (line.includes('import') && line.includes(varName)) {
        // Only remove if it's clearly an unused import
        const newLine = line
          .replace(new RegExp(`\\b${varName}\\b,\\s*`, 'g'), '')
          .replace(new RegExp(`,\\s*\\b${varName}\\b`, 'g'), '')
          .replace(new RegExp(`{\\s*\\b${varName}\\b\\s*}`, 'g'), '{}');
        
        if (newLine.includes('{}')) {
          lines[lineIndex] = '';
          modified = true;
          totalFixed++;
          console.log(`  ✓ ${relativePath}:${fix.line} - Removed empty import: ${varName}`);
        } else if (newLine !== line) {
          lines[lineIndex] = newLine;
          modified = true;
          totalFixed++;
          console.log(`  ✓ ${relativePath}:${fix.line} - Removed from import: ${varName}`);
        }
      }
    }
  }
  
  if (modified) {
    fs.writeFileSync(filePath, lines.join('\n'));
  }
}

// Clean up
fs.unlinkSync('lint-results.json');

console.log(`\n✅ Total fixes applied: ${totalFixed}`);

if (totalFixed > 0) {
  console.log('\nRunning build to verify...');
  try {
    execSync('npm run build', { stdio: 'inherit' });
    console.log('\n✅ Build successful!');
  } catch {
    console.error('\n❌ Build failed. Please review the changes.');
    process.exit(1);
  }
}

