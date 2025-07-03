#!/usr/bin/env node

/**
 * PathOutlines Question Scraper
 * 
 * Scrapes questions from PathOutlines HTML files and converts them to JSON
 * format compatible with Pathology Bites database schema.
 * 
 * Usage:
 *   node scripts/pathoutlines-scraper.js [file.html] [--output output.json] [--category "Category Name"]
 *   node scripts/pathoutlines-scraper.js --all [--output-dir ./scraped-questions]
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// Category mapping from filename to category
const CATEGORY_MAPPING = {
  'adrenal': 'Anatomic Pathology > Endocrine',
  'anus': 'Anatomic Pathology > Gastrointestinal',
  'appendix': 'Anatomic Pathology > Gastrointestinal',
  'autopsy': 'Anatomic Pathology > Forensic',
  'bladder': 'Anatomic Pathology > Genitourinary',
  'body_cavities': 'Anatomic Pathology > General',
  'bone': 'Anatomic Pathology > Musculoskeletal',
  'bone_marrow': 'Clinical Pathology > Hematopathology',
  'bone_marrow_benign': 'Clinical Pathology > Hematopathology',
  'breast': 'Anatomic Pathology > Breast',
  'cervix': 'Anatomic Pathology > Gynecologic',
  'clinical_chemistry': 'Clinical Pathology > Chemistry',
  'cns': 'Anatomic Pathology > Neuropathology',
  'csn_benign': 'Anatomic Pathology > Neuropathology',
  'coagulation': 'Clinical Pathology > Coagulation',
  'colon': 'Anatomic Pathology > Gastrointestinal',
  'cyto': 'Anatomic Pathology > Cytopathology',
  'ear': 'Anatomic Pathology > Head and Neck',
  'esophagus': 'Anatomic Pathology > Gastrointestinal',
  'eye': 'Anatomic Pathology > Ophthalmic',
  'fallopian_tubes': 'Anatomic Pathology > Gynecologic',
  'gallbladder': 'Anatomic Pathology > Gastrointestinal',
  'heart': 'Anatomic Pathology > Cardiovascular',
  'hematology': 'Clinical Pathology > Hematology',
  'ihc': 'Clinical Pathology > Immunohistochemistry',
  'informatics': 'Clinical Pathology > Informatics',
  'kidney': 'Anatomic Pathology > Genitourinary',
  'kidney_medical': 'Anatomic Pathology > Genitourinary',
  'lab_admin': 'Clinical Pathology > Laboratory Management',
  'larynx': 'Anatomic Pathology > Head and Neck',
  'liver': 'Anatomic Pathology > Gastrointestinal',
  'lymph_node_nonneoplastic': 'Clinical Pathology > Hematopathology',
  'lymphoma': 'Clinical Pathology > Hematopathology',
  'mandible_and_maxilla': 'Anatomic Pathology > Head and Neck',
  'mediastinum': 'Anatomic Pathology > Thoracic',
  'microbiology': 'Clinical Pathology > Microbiology',
  'molecular': 'Clinical Pathology > Molecular',
  'muscle_and_nerve': 'Anatomic Pathology > Musculoskeletal',
  'nasopharynx': 'Anatomic Pathology > Head and Neck',
  'oral_cavity': 'Anatomic Pathology > Head and Neck',
  'ovary': 'Anatomic Pathology > Gynecologic',
  'pancreas': 'Anatomic Pathology > Gastrointestinal',
  'penis': 'Anatomic Pathology > Genitourinary',
  'placenta': 'Anatomic Pathology > Gynecologic',
  'prostate': 'Anatomic Pathology > Genitourinary',
  'salivary_gland': 'Anatomic Pathology > Head and Neck',
  'skin_melanocytic': 'Anatomic Pathology > Dermatopathology',
  'skin_non_tumor': 'Anatomic Pathology > Dermatopathology',
  'skin_tumor_nonmelanocytic': 'Anatomic Pathology > Dermatopathology',
  'small_intestine': 'Anatomic Pathology > Gastrointestinal',
  'soft_tissue': 'Anatomic Pathology > Musculoskeletal',
  'spleen': 'Clinical Pathology > Hematopathology',
  'stomach': 'Anatomic Pathology > Gastrointestinal',
  'testis': 'Anatomic Pathology > Genitourinary',
  'thyroid': 'Anatomic Pathology > Endocrine',
  'transfusion': 'Clinical Pathology > Transfusion Medicine',
  'uterus': 'Anatomic Pathology > Gynecologic',
  'vagina': 'Anatomic Pathology > Gynecologic'
};

/**
 * Extract text content from HTML element, cleaning up whitespace
 */
function extractText(element) {
  if (!element) return '';
  return element.textContent.trim().replace(/\s+/g, ' ');
}

/**
 * Extract images from a question block
 */
function extractImages(questionBlock) {
  const images = [];
  const imgElements = questionBlock.querySelectorAll('img');
  
  imgElements.forEach(img => {
    const src = img.getAttribute('src');
    const alt = img.getAttribute('alt') || '';
    const title = img.getAttribute('title') || '';
    
    if (src && src.includes('pathologyoutlines.com')) {
      images.push({
        url: src.startsWith('http') ? src : `https://www.pathologyoutlines.com${src}`,
        alt_text: alt,
        caption: title
      });
    }
  });
  
  return images;
}

/**
 * Parse answer options from ordered list
 */
function parseAnswerOptions(questionBlock) {
  const options = [];
  const olElement = questionBlock.querySelector('ol.liststyle2');

  if (olElement) {
    const listItems = olElement.querySelectorAll('li');
    listItems.forEach((li, index) => {
      const text = extractText(li);
      if (text) {
        options.push({
          option_letter: String.fromCharCode(65 + index), // A, B, C, D, E
          text: text, // Use 'text' instead of 'option_text' to match our schema
          is_correct: false // Will be set when parsing answer
        });
      }
    });
  }

  return options;
}

/**
 * Parse a single question from HTML
 */
function parseQuestion(questionBlock, answerBlock, category, sourceFile) {
  const questionTitle = extractText(questionBlock.querySelector('.f12b'));
  const questionBodyDiv = questionBlock.querySelector('.block_body');

  // Extract question stem (text after images but before answer options)
  let questionStem = '';
  const children = Array.from(questionBodyDiv.childNodes);
  let stemParts = [];

  for (const child of children) {
    if (child.nodeType === 3) { // Text node
      const text = child.textContent.trim();
      if (text && !text.match(/^\s*$/)) {
        stemParts.push(text);
      }
    } else if (child.tagName === 'BR') {
      stemParts.push(' ');
    } else if (child.tagName === 'OL') {
      break; // Stop at answer options
    } else if (child.tagName !== 'DIV' || !child.classList.contains('img1') && !child.classList.contains('img2')) {
      const text = extractText(child);
      if (text) {
        stemParts.push(text);
      }
    }
  }

  questionStem = stemParts.join(' ').replace(/\s+/g, ' ').trim();

  // Add image information to stem if images exist
  const images = extractImages(questionBlock);
  if (images.length > 0) {
    const imageInfo = images.map((img, index) =>
      `[Image ${index + 1}: ${img.url}${img.caption ? ` - ${img.caption}` : ''}]`
    ).join(' ');
    questionStem = `${imageInfo}\n\n${questionStem}`;
  }

  // Extract answer options in the format expected by our import system
  const answerOptions = parseAnswerOptions(questionBlock);

  // Parse correct answer from answer block
  let correctAnswer = '';
  let explanation = '';
  let teachingPoint = '';
  let reference = '';

  if (answerBlock) {
    const answerBody = answerBlock.querySelector('.answer_block');
    if (answerBody) {
      const answerText = extractText(answerBody);

      // Extract correct answer - look for <b>A.</b>, <b>B.</b>, etc.
      const boldElement = answerBody.querySelector('b');
      if (boldElement) {
        const boldText = extractText(boldElement);
        const answerMatch = boldText.match(/^([A-E])\./);
        if (answerMatch) {
          correctAnswer = answerMatch[1];

          // Mark correct option
          answerOptions.forEach(option => {
            if (option.option_letter === correctAnswer) {
              option.is_correct = true;
            }
          });
        }
      }

      // Extract explanation (everything after the bold answer)
      explanation = answerText;
      if (boldElement) {
        const boldText = extractText(boldElement);
        explanation = answerText.replace(boldText, '').trim();
      }

      // Clean up explanation - remove "Answer X is incorrect because" patterns
      explanation = explanation.replace(/Answer [A-E] is incorrect because/gi, '').trim();

      // Use explanation as teaching point (required field)
      teachingPoint = explanation.length > 10 ? explanation :
        `This question tests knowledge of ${category.split(' > ')[1] || category}.`;

      // Extract reference link
      const refLink = answerBody.querySelector('a[href*="pathologyoutlines.com/topic"]');
      if (refLink) {
        reference = refLink.getAttribute('href');
        if (reference && !reference.startsWith('http')) {
          reference = `https://www.pathologyoutlines.com${reference}`;
        }
      }
    }
  }

  // Convert to format expected by our import system
  const formattedAnswerOptions = answerOptions.map((option, index) => ({
    text: option.text,
    is_correct: option.is_correct,
    explanation: option.is_correct ? explanation : `This option is incorrect. ${explanation}`,
    order_index: index
  }));

  return {
    title: questionTitle || 'Untitled Question',
    stem: questionStem,
    difficulty: 'medium', // Default difficulty
    teaching_point: teachingPoint,
    question_references: reference || `Source: PathOutlines (${sourceFile})`,
    status: 'draft',
    answer_options: formattedAnswerOptions,
    // Note: Images, tags, and categories would need to be handled separately
    // since they require existing UUIDs in the database
    _metadata: {
      source: 'PathOutlines',
      source_file: sourceFile,
      category: category,
      images: images,
      database_set: 'Web'
    }
  };
}

/**
 * Scrape questions from a single HTML file
 */
function scrapeFile(filePath, category = null) {
  console.log(`Scraping ${filePath}...`);
  
  const html = fs.readFileSync(filePath, 'utf8');
  const dom = new JSDOM(html);
  const document = dom.window.document;
  
  // Determine category from filename if not provided
  if (!category) {
    const filename = path.basename(filePath, '.html');
    category = CATEGORY_MAPPING[filename] || 'Uncategorized';
  }
  
  const questions = [];
  const questionBlocks = document.querySelectorAll('.block_content .block_section.question');
  
  questionBlocks.forEach((questionBlock, index) => {
    try {
      // Find corresponding answer block
      const questionId = questionBlock.getAttribute('id');
      let answerBlock = null;

      if (questionId) {
        // Try direct replacement first
        let answerId = questionId.replace('practicequestion', 'practiceanswer');
        answerBlock = document.getElementById(answerId);

        // If not found, try incrementing the number by 1 (common pattern in PathOutlines)
        if (!answerBlock) {
          const numberMatch = questionId.match(/(\d+)$/);
          if (numberMatch) {
            const questionNumber = parseInt(numberMatch[1]);
            const answerNumber = questionNumber + 1;
            answerId = questionId.replace(/\d+$/, answerNumber.toString());
            answerBlock = document.getElementById(answerId);
          }
        }
      }

      const question = parseQuestion(questionBlock, answerBlock, category, path.basename(filePath));

      if (question.stem && question.answer_options.length > 0) {
        questions.push(question);
      } else {
        console.warn(`Skipping incomplete question ${index + 1} in ${filePath}`);
      }
    } catch (error) {
      console.error(`Error parsing question ${index + 1} in ${filePath}:`, error.message);
    }
  });
  
  console.log(`Extracted ${questions.length} questions from ${filePath}`);
  return questions;
}

// Main execution
function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
PathOutlines Question Scraper

Usage:
  node scripts/pathoutlines-scraper.js [file.html] [--output output.json] [--category "Category Name"]
  node scripts/pathoutlines-scraper.js --all [--output-dir ./scraped-questions]

Options:
  --help, -h          Show this help message
  --all               Scrape all HTML files in pathoutlines directory
  --output, -o        Output JSON file (default: questions.json)
  --output-dir        Output directory for --all mode (default: ./scraped-questions)
  --category, -c      Override category for the questions

Examples:
  node scripts/pathoutlines-scraper.js pathoutlines/kidney.html
  node scripts/pathoutlines-scraper.js pathoutlines/kidney.html --output kidney-questions.json
  node scripts/pathoutlines-scraper.js --all --output-dir ./questions
    `);
    return;
  }
  
  if (args.includes('--all')) {
    // Scrape all files
    const outputDir = args[args.indexOf('--output-dir') + 1] || './scraped-questions';
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const pathoutlinesDir = './pathoutlines';
    const files = fs.readdirSync(pathoutlinesDir).filter(f => f.endsWith('.html'));
    
    files.forEach(file => {
      try {
        const filePath = path.join(pathoutlinesDir, file);
        const questions = scrapeFile(filePath);
        
        const outputFile = path.join(outputDir, `${path.basename(file, '.html')}.json`);
        fs.writeFileSync(outputFile, JSON.stringify(questions, null, 2));
        console.log(`Saved ${questions.length} questions to ${outputFile}`);
      } catch (error) {
        console.error(`Error processing ${file}:`, error.message);
      }
    });
    
  } else {
    // Scrape single file
    const inputFile = args[0];
    if (!inputFile) {
      console.error('Please provide an HTML file to scrape');
      process.exit(1);
    }
    
    const outputIndex = args.indexOf('--output') !== -1 ? args.indexOf('--output') : args.indexOf('-o');
    const outputFile = outputIndex !== -1 ? args[outputIndex + 1] : 'questions.json';
    
    const categoryIndex = args.indexOf('--category') !== -1 ? args.indexOf('--category') : args.indexOf('-c');
    const category = categoryIndex !== -1 ? args[categoryIndex + 1] : null;
    
    try {
      const questions = scrapeFile(inputFile, category);
      fs.writeFileSync(outputFile, JSON.stringify(questions, null, 2));
      console.log(`Saved ${questions.length} questions to ${outputFile}`);
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  }
}

if (require.main === module) {
  main();
}

module.exports = { scrapeFile, parseQuestion, extractImages };

/**
 * Image Loading Analysis
 *
 * Regarding loading images directly from PathOutlines:
 *
 * 1. TECHNICAL FEASIBILITY: Yes, images can be loaded directly from PathOutlines URLs
 *    - All images use absolute URLs: https://www.pathologyoutlines.com/imgau/...
 *    - No authentication required for image access
 *    - Standard HTTP/HTTPS image loading
 *
 * 2. LEGAL CONSIDERATIONS:
 *    - Images are copyrighted by PathologyOutlines.com
 *    - Direct hotlinking may violate their terms of service
 *    - Consider fair use for educational purposes
 *    - Recommend contacting PathOutlines for permission
 *
 * 3. TECHNICAL IMPLEMENTATION:
 *    - Images can be displayed using standard <img> tags
 *    - Consider caching/proxying to avoid direct hotlinking
 *    - Implement fallback for broken/missing images
 *
 * 4. RECOMMENDED APPROACH:
 *    - For testing: Direct image URLs work fine
 *    - For production: Download and host images locally
 *    - Add image download functionality to this scraper
 *
 * Example image URLs found:
 * - https://www.pathologyoutlines.com/imgau/kidneytumorWHOclassTretiakovaBRQ1A.jpg
 * - https://www.pathologyoutlines.com/imgau/kidneytumormalignantclearcellpapillarymaclennan07.jpg
 */
