#!/usr/bin/env node

/**
 * Demo Questions CLI Tool
 * 
 * Usage:
 *   node scripts/demo-questions.js list
 *   node scripts/demo-questions.js add <question-id>
 *   node scripts/demo-questions.js remove <demo-id>
 *   node scripts/demo-questions.js activate <demo-id>
 *   node scripts/demo-questions.js deactivate <demo-id>
 */

const https = require('https');
const http = require('http');

// Configuration
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const API_ENDPOINT = `${BASE_URL}/api/admin/demo-questions`;

// Helper function to make HTTP requests
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https');
    const client = isHttps ? https : http;
    
    const req = client.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: result });
        } catch (error) {
          resolve({ status: res.statusCode, data: { error: 'Invalid JSON response' } });
        }
      });
    });

    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

// Commands
async function listDemoQuestions() {
  try {
    console.log('📋 Fetching demo questions...\n');
    
    const response = await makeRequest(API_ENDPOINT);
    
    if (response.status !== 200) {
      console.error('❌ Error:', response.data.error || 'Failed to fetch demo questions');
      return;
    }

    const questions = response.data;
    
    if (questions.length === 0) {
      console.log('📝 No demo questions configured');
      return;
    }

    console.log(`📚 Demo Questions (${questions.length} total):\n`);
    
    questions.forEach((demo, index) => {
      const status = demo.is_active ? '✅ Active' : '⏸️  Inactive';
      console.log(`${index + 1}. [Order: ${demo.display_order}] ${status}`);
      console.log(`   Title: ${demo.questions.title}`);
      console.log(`   Question ID: ${demo.question_id}`);
      console.log(`   Demo ID: ${demo.id}`);
      console.log('');
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function addDemoQuestion(questionId) {
  if (!questionId) {
    console.error('❌ Error: Question ID is required');
    console.log('Usage: node scripts/demo-questions.js add <question-id>');
    return;
  }

  try {
    console.log(`➕ Adding question ${questionId} to demo rotation...`);
    
    const response = await makeRequest(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ question_id: questionId })
    });

    if (response.status === 201) {
      const demo = response.data;
      console.log('✅ Demo question added successfully!');
      console.log(`   Title: ${demo.questions.title}`);
      console.log(`   Display Order: ${demo.display_order}`);
      console.log(`   Demo ID: ${demo.id}`);
    } else {
      console.error('❌ Error:', response.data.error || 'Failed to add demo question');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function removeDemoQuestion(demoId) {
  if (!demoId) {
    console.error('❌ Error: Demo ID is required');
    console.log('Usage: node scripts/demo-questions.js remove <demo-id>');
    return;
  }

  try {
    console.log(`🗑️  Removing demo question ${demoId}...`);
    
    const response = await makeRequest(`${API_ENDPOINT}?id=${demoId}`, {
      method: 'DELETE'
    });

    if (response.status === 200) {
      console.log('✅ Demo question removed successfully!');
    } else {
      console.error('❌ Error:', response.data.error || 'Failed to remove demo question');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function toggleDemoQuestion(demoId, activate) {
  if (!demoId) {
    console.error('❌ Error: Demo ID is required');
    console.log(`Usage: node scripts/demo-questions.js ${activate ? 'activate' : 'deactivate'} <demo-id>`);
    return;
  }

  try {
    const action = activate ? 'Activating' : 'Deactivating';
    console.log(`${activate ? '▶️' : '⏸️'} ${action} demo question ${demoId}...`);
    
    const response = await makeRequest(API_ENDPOINT, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        id: demoId, 
        is_active: activate 
      })
    });

    if (response.status === 200) {
      const demo = response.data;
      console.log(`✅ Demo question ${activate ? 'activated' : 'deactivated'} successfully!`);
      console.log(`   Title: ${demo.questions.title}`);
      console.log(`   Status: ${demo.is_active ? 'Active' : 'Inactive'}`);
    } else {
      console.error('❌ Error:', response.data.error || `Failed to ${activate ? 'activate' : 'deactivate'} demo question`);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

function showHelp() {
  console.log(`
🎯 Demo Questions CLI Tool

Usage:
  node scripts/demo-questions.js <command> [arguments]

Commands:
  list                     List all demo questions
  add <question-id>        Add a question to demo rotation
  remove <demo-id>         Remove a question from demo rotation
  activate <demo-id>       Activate a demo question
  deactivate <demo-id>     Deactivate a demo question
  help                     Show this help message

Examples:
  node scripts/demo-questions.js list
  node scripts/demo-questions.js add 44fa801d-dfe8-43d0-a410-b49841c8d9db
  node scripts/demo-questions.js remove dc7a4ccd-1ee0-424d-ae35-296a0fdbdde1
  node scripts/demo-questions.js activate dc7a4ccd-1ee0-424d-ae35-296a0fdbdde1

Note: Make sure your development server is running on ${BASE_URL}
`);
}

// Main execution
async function main() {
  const command = process.argv[2];
  const arg = process.argv[3];

  switch (command) {
    case 'list':
      await listDemoQuestions();
      break;
    case 'add':
      await addDemoQuestion(arg);
      break;
    case 'remove':
      await removeDemoQuestion(arg);
      break;
    case 'activate':
      await toggleDemoQuestion(arg, true);
      break;
    case 'deactivate':
      await toggleDemoQuestion(arg, false);
      break;
    case 'help':
    case '--help':
    case '-h':
      showHelp();
      break;
    default:
      console.error('❌ Unknown command:', command);
      showHelp();
      process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { listDemoQuestions, addDemoQuestion, removeDemoQuestion, toggleDemoQuestion };
