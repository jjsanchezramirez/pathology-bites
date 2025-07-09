#!/usr/bin/env python3

"""
PathOutlines Question Scraper (Python Version)

Scrapes questions from PathOutlines HTML files and converts them to JSON
format compatible with Pathology Bites database schema.

Usage:
    python scripts/pathoutlines_scraper.py [file.html] [--output output.json] [--category "Category Name"]
    python scripts/pathoutlines_scraper.py --all [--output-dir ./scraped-questions]

Requirements:
    pip install beautifulsoup4 lxml
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

try:
    from bs4 import BeautifulSoup
except ImportError:
    print("Error: BeautifulSoup4 is required. Install with: pip install beautifulsoup4 lxml")
    sys.exit(1)

# Category mapping from filename to category
CATEGORY_MAPPING = {
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
}


def clean_text(text: str) -> str:
    """Clean and normalize text content."""
    if not text:
        return ''
    # Replace multiple whitespace with single space
    text = re.sub(r'\s+', ' ', text.strip())
    return text


def extract_images(question_block) -> List[Dict]:
    """Extract images from a question block."""
    images = []
    img_elements = question_block.find_all('img')
    
    for img in img_elements:
        src = img.get('src', '')
        alt = img.get('alt', '')
        title = img.get('title', '')
        
        if src and 'pathologyoutlines.com' in src:
            # Ensure absolute URL
            if not src.startswith('http'):
                src = f"https://www.pathologyoutlines.com{src}"
            
            images.append({
                'url': src,
                'alt_text': alt,
                'caption': title
            })
    
    return images


def parse_answer_options(question_block) -> List[Dict]:
    """Parse answer options from ordered list."""
    options = []
    ol_element = question_block.find('ol', class_='liststyle2')
    
    if ol_element:
        list_items = ol_element.find_all('li')
        for index, li in enumerate(list_items):
            text = clean_text(li.get_text())
            if text:
                options.append({
                    'option_letter': chr(65 + index),  # A, B, C, D, E
                    'text': text,
                    'is_correct': False  # Will be set when parsing answer
                })
    
    return options


def parse_question_stem(question_block) -> str:
    """Extract question stem from question block."""
    question_body = question_block.find('div', class_='block_body')
    if not question_body:
        return ''
    
    # Get all text nodes before the answer options (ol element)
    stem_parts = []
    
    for element in question_body.children:
        if hasattr(element, 'name'):
            if element.name == 'ol':
                break  # Stop at answer options
            elif element.name in ['div'] and 'img' in str(element):
                continue  # Skip image divs, we handle images separately
            else:
                text = clean_text(element.get_text())
                if text:
                    stem_parts.append(text)
        else:
            # Text node
            text = clean_text(str(element))
            if text:
                stem_parts.append(text)
    
    return ' '.join(stem_parts)


def parse_answer_block(answer_block) -> Tuple[str, str, str]:
    """Parse answer block to extract correct answer, explanation, and reference."""
    if not answer_block:
        return '', '', ''

    answer_body = answer_block.find('div', class_='answer_block')
    if not answer_body:
        return '', '', ''

    # Extract correct answer from bold element
    correct_answer = ''
    bold_element = answer_body.find('b')
    if bold_element:
        bold_text = clean_text(bold_element.get_text())
        answer_match = re.match(r'^([A-E])\.?$', bold_text)  # Allow optional period
        if answer_match:
            correct_answer = answer_match.group(1)

    # Extract full explanation text
    explanation = clean_text(answer_body.get_text())

    # Remove the bold answer letter from explanation
    if bold_element:
        bold_text = clean_text(bold_element.get_text())
        explanation = explanation.replace(bold_text, '', 1).strip()

    # Clean up common patterns in explanations
    explanation = re.sub(r'Answer [A-E] is incorrect because', '', explanation, flags=re.IGNORECASE)
    explanation = re.sub(r'Comment Here\s*Reference:', '', explanation, flags=re.IGNORECASE)
    explanation = clean_text(explanation)

    # Extract reference link
    reference = ''
    ref_link = answer_body.find('a', href=re.compile(r'pathologyoutlines\.com/topic'))
    if ref_link:
        reference = ref_link.get('href', '')
        if reference and not reference.startswith('http'):
            reference = f"https://www.pathologyoutlines.com{reference}"

    return correct_answer, explanation, reference


def parse_question(question_block, answer_block, category: str, source_file: str) -> Dict:
    """Parse a single question from HTML blocks."""
    # Extract question title
    title_element = question_block.find('div', class_='f12b')
    title = clean_text(title_element.get_text()) if title_element else 'Untitled Question'

    # Extract question stem (without images embedded)
    stem = parse_question_stem(question_block)

    # Extract images for question_images array
    images = extract_images(question_block)
    question_images = []
    for i, img in enumerate(images):
        question_images.append({
            'image_url': img['url'],  # We'll use this for download during import
            'question_section': 'stem',
            'order_index': i,
            'alt_text': img['alt_text'],
            'caption': img['caption']
        })

    # Extract answer options
    answer_options = parse_answer_options(question_block)

    # Parse answer block
    correct_answer, explanation, reference = parse_answer_block(answer_block)

    # Mark correct option and add explanations
    for option in answer_options:
        if option['option_letter'] == correct_answer:
            option['is_correct'] = True

    # Format answer options for our schema
    formatted_options = []
    for i, option in enumerate(answer_options):
        # Create appropriate explanation for each option
        if option['is_correct']:
            option_explanation = explanation
        else:
            # For incorrect options, provide a brief explanation
            option_explanation = f"Incorrect. The correct answer is {correct_answer}. {explanation[:100]}..." if len(explanation) > 100 else f"Incorrect. The correct answer is {correct_answer}. {explanation}"

        formatted_options.append({
            'text': option['text'],
            'is_correct': option['is_correct'],
            'explanation': option_explanation,
            'order_index': i
        })

    # Create teaching point
    teaching_point = explanation if len(explanation) > 10 else f"This question tests knowledge of {category.split(' > ')[-1]}."

    # Create the question object matching our import schema
    question_data = {
        'title': title,
        'stem': stem,
        'difficulty': 'medium',  # Default difficulty
        'teaching_point': teaching_point,
        'question_references': reference or f"Source: PathOutlines ({source_file})",
        'status': 'draft',
        'answer_options': formatted_options
    }

    # Add question_images if any exist
    if question_images:
        question_data['question_images'] = question_images

    # Add empty arrays for optional fields (can be populated later)
    question_data['tag_ids'] = []
    question_data['category_ids'] = []

    # Add metadata for reference (not part of import schema)
    question_data['_metadata'] = {
        'source': 'PathOutlines',
        'source_file': source_file,
        'category': category,
        'database_set': 'Web'
    }

    return question_data


def scrape_file(file_path: str, category: Optional[str] = None) -> List[Dict]:
    """Scrape questions from a single HTML file."""
    print(f"Scraping {file_path}...")
    
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        html_content = f.read()
    
    soup = BeautifulSoup(html_content, 'lxml')
    
    # Determine category from filename if not provided
    if not category:
        filename = Path(file_path).stem
        category = CATEGORY_MAPPING.get(filename, 'Uncategorized')
    
    questions = []
    question_blocks = soup.find_all('div', class_='block_section question')
    
    for i, question_block in enumerate(question_blocks):
        try:
            # Find corresponding answer block
            question_id = question_block.get('id', '')
            answer_block = None
            
            if question_id:
                # Try direct replacement first
                answer_id = question_id.replace('practicequestion', 'practiceanswer')
                answer_block = soup.find('div', id=answer_id)

                # If not found, try incrementing the number by 1
                if not answer_block:
                    number_match = re.search(r'(\d+)$', question_id)
                    if number_match:
                        question_number = int(number_match.group(1))
                        answer_number = question_number + 1
                        answer_id = question_id.replace('practicequestion', 'practiceanswer')
                        answer_id = re.sub(r'\d+$', str(answer_number), answer_id)
                        answer_block = soup.find('div', id=answer_id)


            
            question = parse_question(question_block, answer_block, category, Path(file_path).name)
            
            if question['stem'] and question['answer_options']:
                questions.append(question)
            else:
                print(f"Warning: Skipping incomplete question {i + 1} in {file_path}")
                
        except Exception as e:
            print(f"Error parsing question {i + 1} in {file_path}: {e}")
    
    print(f"Extracted {len(questions)} questions from {file_path}")
    return questions


def main():
    parser = argparse.ArgumentParser(description='Scrape PathOutlines questions to JSON')
    parser.add_argument('file', nargs='?', help='HTML file to scrape')
    parser.add_argument('--all', action='store_true', help='Scrape all HTML files in pathoutlines directory')
    parser.add_argument('--output', '-o', default='questions.json', help='Output JSON file')
    parser.add_argument('--output-dir', default='./scraped-questions', help='Output directory for --all mode')
    parser.add_argument('--category', '-c', help='Override category for the questions')
    
    args = parser.parse_args()
    
    if args.all:
        # Scrape all files
        pathoutlines_dir = Path('./pathoutlines')
        if not pathoutlines_dir.exists():
            print("Error: pathoutlines directory not found")
            sys.exit(1)
        
        output_dir = Path(args.output_dir)
        output_dir.mkdir(exist_ok=True)
        
        html_files = list(pathoutlines_dir.glob('*.html'))
        
        for html_file in html_files:
            try:
                questions = scrape_file(str(html_file))
                output_file = output_dir / f"{html_file.stem}.json"
                
                with open(output_file, 'w', encoding='utf-8') as f:
                    json.dump(questions, f, indent=2, ensure_ascii=False)
                
                print(f"Saved {len(questions)} questions to {output_file}")
                
            except Exception as e:
                print(f"Error processing {html_file}: {e}")
    
    else:
        # Scrape single file
        if not args.file:
            print("Error: Please provide an HTML file to scrape or use --all")
            sys.exit(1)
        
        if not Path(args.file).exists():
            print(f"Error: File {args.file} not found")
            sys.exit(1)
        
        try:
            questions = scrape_file(args.file, args.category)
            
            with open(args.output, 'w', encoding='utf-8') as f:
                json.dump(questions, f, indent=2, ensure_ascii=False)
            
            print(f"Saved {len(questions)} questions to {args.output}")
            
        except Exception as e:
            print(f"Error: {e}")
            sys.exit(1)


if __name__ == '__main__':
    main()
