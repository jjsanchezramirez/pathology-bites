#!/usr/bin/env node

/**
 * Environment Validation Script for Pathology Bites
 * 
 * This script validates that all required environment variables are properly set
 * and provides helpful error messages for missing or invalid configurations.
 */

const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env.local');

  if (!fs.existsSync(envPath)) {
    return false;
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=');
      if (key && value) {
        process.env[key] = value;
      }
    }
  }

  return true;
}

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function validateUrl(url, name) {
  try {
    new URL(url);
    return true;
  } catch {
    log(`❌ ${name} is not a valid URL: ${url}`, 'red');
    return false;
  }
}

function validateEnvFile() {
  log('\n🔍 Validating Environment Configuration...', 'cyan');

  const envLoaded = loadEnvFile();

  if (!envLoaded) {
    log('❌ .env.local file not found!', 'red');
    log('💡 Run: cp .env.example .env.local', 'yellow');
    return false;
  }

  log('✅ .env.local file exists and loaded', 'green');

  // Required environment variables
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY'
  ];

  // Optional but recommended
  const recommended = [
    'NEXT_PUBLIC_SITE_URL',
    'NEXT_PUBLIC_GOOGLE_CLIENT_ID',
    'CLOUDFLARE_R2_ACCESS_KEY_ID',
    'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
    'RESEND_API_KEY'
  ];

  let hasErrors = false;
  let hasWarnings = false;

  log('\n📋 Checking Required Variables:', 'bold');
  
  for (const varName of required) {
    const value = process.env[varName];
    
    if (!value) {
      log(`❌ ${varName} is missing`, 'red');
      hasErrors = true;
    } else if (value.includes('your_') || value.includes('_here')) {
      log(`❌ ${varName} contains placeholder value`, 'red');
      hasErrors = true;
    } else {
      log(`✅ ${varName} is set`, 'green');
      
      // Validate URLs
      if (varName.includes('URL')) {
        validateUrl(value, varName);
      }
    }
  }

  log('\n📋 Checking Recommended Variables:', 'bold');
  
  for (const varName of recommended) {
    const value = process.env[varName];
    
    if (!value) {
      log(`⚠️  ${varName} is not set (optional)`, 'yellow');
      hasWarnings = true;
    } else if (value.includes('your_') || value.includes('_here')) {
      log(`⚠️  ${varName} contains placeholder value`, 'yellow');
      hasWarnings = true;
    } else {
      log(`✅ ${varName} is set`, 'green');
    }
  }

  // Check for common issues
  log('\n🔧 Checking Configuration Issues:', 'bold');
  
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  
  if (siteUrl && appUrl && siteUrl !== appUrl) {
    log(`⚠️  NEXT_PUBLIC_SITE_URL and NEXT_PUBLIC_APP_URL differ`, 'yellow');
    log(`   SITE_URL: ${siteUrl}`, 'yellow');
    log(`   APP_URL: ${appUrl}`, 'yellow');
  }

  // Check AI API keys
  const aiKeys = [
    'NEXT_PUBLIC_LLAMA_API_KEY',
    'NEXT_PUBLIC_GROQ_API_KEY',
    'NEXT_PUBLIC_GEMINI_API_KEY',
    'NEXT_PUBLIC_CLAUDE_API_KEY',
    'NEXT_PUBLIC_OPENAI_API_KEY',
    'NEXT_PUBLIC_MISTRAL_API_KEY',
    'NEXT_PUBLIC_DEEPSEEK_API_KEY'
  ];

  const validAiKeys = aiKeys.filter(key => {
    const value = process.env[key];
    return value && !value.includes('your_') && !value.includes('_here');
  });

  if (validAiKeys.length > 0) {
    log(`✅ ${validAiKeys.length} AI API key(s) configured`, 'green');
  } else {
    log(`⚠️  No AI API keys configured (AI features will be disabled)`, 'yellow');
  }

  // Summary
  log('\n📊 Validation Summary:', 'bold');
  
  if (hasErrors) {
    log('❌ Environment validation failed - fix required variables', 'red');
    return false;
  } else if (hasWarnings) {
    log('⚠️  Environment validation passed with warnings', 'yellow');
    return true;
  } else {
    log('✅ Environment validation passed successfully!', 'green');
    return true;
  }
}

function main() {
  log('🚀 Pathology Bites Environment Validator', 'cyan');
  
  const isValid = validateEnvFile();
  
  if (!isValid) {
    log('\n💡 Quick Setup Guide:', 'blue');
    log('1. Copy example file: cp .env.example .env.local', 'blue');
    log('2. Get Supabase credentials from: https://app.supabase.com/project/[id]/settings/api', 'blue');
    log('3. Update the required variables in .env.local', 'blue');
    log('4. Run this script again to validate', 'blue');
    
    process.exit(1);
  }
  
  log('\n🎉 Ready to start development!', 'green');
  log('Run: npm run dev', 'green');
}

if (require.main === module) {
  main();
}

module.exports = { validateEnvFile };
