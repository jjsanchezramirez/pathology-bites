#!/usr/bin/env node

/**
 * Fix unused error variables in catch blocks by removing the parameter entirely
 * catch (error) { } -> catch { }
 * catch (_error) { } -> catch { }
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Running ESLint to find unused catch block parameters...');
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

// Collect all unused error variables
for (const result of lintResults) {
  if (!result.messages.length) continue;
  
  const filePath = result.filePath;
  if (filePath.includes('dev/scripts') || filePath.includes('node_modules')) continue;
  
  const fixes = [];
  
  for (const message of result.messages) {
    if (message.ruleId === '@typescript-eslint/no-unused-vars') {
      const match = message.message.match(/'([^']+)' is defined but never used/);
      if (match) {
        const varName = match[1];
        // Only process error-like variable names
        if (varName === 'error' || varName === '_error' || varName === 'err' || varName === '_err' || 
            varName === 'e' || varName === '_e') {
          fixes.push({
            line: message.line,
            varName: varName
          });
        }
      }
    }
  }
  
  if (fixes.length > 0) {
    filesToFix.set(filePath, fixes);
  }
}

console.log(`\nFound ${filesToFix.size} files with unused catch parameters`);

// Process each file
for (const [filePath, fixes] of filesToFix) {
  const relativePath = path.relative(process.cwd(), filePath);
  
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  let modified = false;
  
  // Sort fixes by line number (descending)
  fixes.sort((a, b) => b.line - a.line);
  
  for (const fix of fixes) {
    const lineIndex = fix.line - 1;
    const line = lines[lineIndex];
    
    // Check if this is a catch block
    if (line.includes('catch')) {
      // Remove the parameter: catch (error) -> catch
      const newLine = line.replace(
        /catch\s*\(\s*_?(?:error|err|e)\s*\)/g,
        'catch'
      );
      
      if (newLine !== line) {
        lines[lineIndex] = newLine;
        modified = true;
        totalFixed++;
        console.log(`  ✓ ${relativePath}:${fix.line} - Removed unused catch parameter: ${fix.varName}`);
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
  console.log('\nRunning lint to verify...');
  try {
    const output = execSync('npm run lint 2>&1 | tail -5', { encoding: 'utf8' });
    console.log(output);
  } catch {
    // Ignore
  }
}

