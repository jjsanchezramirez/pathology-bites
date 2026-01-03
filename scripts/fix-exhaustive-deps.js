#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');

// Get all exhaustive-deps warnings
const lintOutput = execSync('npm run lint 2>&1', { encoding: 'utf-8' });
const lines = lintOutput.split('\n');

const warnings = [];
let currentFile = null;

for (const line of lines) {
  // Match file path
  if (line.match(/^\/.*\.tsx?$/)) {
    currentFile = line.trim();
  }
  // Match exhaustive-deps warning
  else if (line.includes('react-hooks/exhaustive-deps') && currentFile) {
    const match = line.match(/^\s*(\d+):(\d+)\s+warning\s+(.+?)\s+react-hooks\/exhaustive-deps/);
    if (match) {
      const [, lineNum, , message] = match;
      warnings.push({
        file: currentFile,
        line: parseInt(lineNum),
        message: message.trim()
      });
    }
  }
}

console.log(`Found ${warnings.length} exhaustive-deps warnings to fix\n`);

let fixedCount = 0;
const fileChanges = new Map();

for (const warning of warnings) {
  const filePath = warning.file;
  
  if (!fs.existsSync(filePath)) {
    continue;
  }

  let content = fileChanges.get(filePath) || fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  // Get the line with the dependency array
  const targetLineIndex = warning.line - 1;
  if (targetLineIndex >= lines.length) continue;
  
  const targetLine = lines[targetLineIndex];
  
  // Extract missing dependencies from the message
  const missingDeps = extractMissingDeps(warning.message);
  if (missingDeps.length === 0) continue;
  
  // Check if this is an empty dependency array []
  if (targetLine.includes('[]')) {
    // Replace [] with the missing dependencies
    const newLine = targetLine.replace('[]', `[${missingDeps.join(', ')}]`);
    lines[targetLineIndex] = newLine;
    fileChanges.set(filePath, lines.join('\n'));
    fixedCount++;
  }
  // Check if this has some dependencies already
  else if (targetLine.match(/\[.*\]/)) {
    // Extract existing dependencies
    const match = targetLine.match(/\[(.*)\]/);
    if (match) {
      const existingDeps = match[1].split(',').map(d => d.trim()).filter(Boolean);
      const allDeps = [...new Set([...existingDeps, ...missingDeps])];
      const newLine = targetLine.replace(/\[.*\]/, `[${allDeps.join(', ')}]`);
      lines[targetLineIndex] = newLine;
      fileChanges.set(filePath, lines.join('\n'));
      fixedCount++;
    }
  }
}

// Write all changes
for (const [filePath, content] of fileChanges) {
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`✓ Fixed ${filePath.replace(process.cwd() + '/', '')}`);
}

console.log(`\n✅ Fixed ${fixedCount} exhaustive-deps warnings`);

function extractMissingDeps(message) {
  const deps = [];
  
  // Pattern: "missing dependency: 'dep'"
  const singleMatch = message.match(/missing dependency: '([^']+)'/);
  if (singleMatch) {
    deps.push(singleMatch[1]);
  }
  
  // Pattern: "missing dependencies: 'dep1' and 'dep2'"
  const multiMatch = message.match(/missing dependencies: (.+?)\. Either/);
  if (multiMatch) {
    const depStr = multiMatch[1];
    const matches = depStr.matchAll(/'([^']+)'/g);
    for (const match of matches) {
      deps.push(match[1]);
    }
  }
  
  return deps;
}

