#!/usr/bin/env python3
"""
Comprehensive Virtual Slides Data Consolidation Script

This script consolidates data from all virtual slide repositories into a unified format.
Each repository has different field names and structures, so we map them to a common schema.

Unified Schema:
- id: unique identifier
- repository: source repository name
- category: main pathology category
- subcategory: subcategory/organ system
- diagnosis: primary diagnosis
- patient_info: age, sex, clinical history combined
- age: extracted age
- gender: extracted gender
- clinical_history: clinical details/history
- stain_type: stain information
- preview_image_url: thumbnail/preview image
- slide_url: main WSI URL
- case_url: case page URL
- other_urls: additional URLs (seminars, etc.)
- source_metadata: original data for reference
"""

import json
import re
from pathlib import Path
from typing import Dict, List, Any, Optional

def extract_age_gender(patient_info: str) -> tuple[Optional[str], Optional[str]]:
    """Extract age and gender from patient info string."""
    age = None
    gender = None
    
    # Extract age patterns
    age_patterns = [
        r'(\d+)\s*(?:years?|yrs?|y\.o\.?)',
        r'(\d+)\s*(?:months?|mos?)',
        r'(\d+)\s*(?:days?)',
    ]
    
    for pattern in age_patterns:
        match = re.search(pattern, patient_info, re.IGNORECASE)
        if match:
            age = match.group(1)
            if 'month' in match.group(0).lower():
                age += ' months'
            elif 'day' in match.group(0).lower():
                age += ' days'
            else:
                age += ' years'
            break
    
    # Extract gender
    if re.search(r'\b(?:female|f)\b', patient_info, re.IGNORECASE):
        gender = 'Female'
    elif re.search(r'\b(?:male|m)\b', patient_info, re.IGNORECASE):
        gender = 'Male'
    
    return age, gender

def process_hemepath_etutorial(data: Dict) -> List[Dict]:
    """Process Hematopathology eTutorial data."""
    results = []
    repository = "Hematopathology eTutorial"

    for lesson in data.get('lessons', []):
        for slide in lesson.get('slides', []):
            # Convert the URL to the correct .svs format
            original_url = slide.get('url', '')
            slide_url = ''
            if original_url:
                # For Hematopathology eTutorial, convert to proper .svs URL format
                # The original URL is usually just the filename, we need to add the domain
                if original_url.startswith('/files/') or not original_url.startswith('http'):
                    # Clean the filename and ensure it has .svs extension
                    filename = original_url.replace('/files/', '') if original_url.startswith('/files/') else original_url
                    if not filename.endswith('.svs'):
                        filename += '.svs'
                    slide_url = f"http://www.hematopathologyetutorial.com/files/{filename}"
                else:
                    slide_url = original_url

            result = {
                'id': f"hemepath_{slide.get('id', '')}",
                'repository': repository,
                'category': 'Hematopathology',
                'subcategory': slide.get('specimen_type', ''),
                'diagnosis': slide.get('title', ''),
                'patient_info': '',
                'age': None,
                'gender': None,
                'clinical_history': '',
                'stain_type': '',
                'preview_image_url': '',
                'slide_url': slide_url,
                'case_url': original_url,
                'other_urls': [lesson.get('study_notes', '')],
                'source_metadata': {
                    'lesson_number': lesson.get('lesson_number'),
                    'lesson_title': lesson.get('title'),
                    'original_data': slide
                }
            }
            results.append(result)

    return results

def process_leeds(data: List[Dict]) -> List[Dict]:
    """Process Leeds University data."""
    results = []
    repository = "Leeds University"
    
    for i, case in enumerate(data):
        age, gender = extract_age_gender(case.get('patient_info', ''))
        
        result = {
            'id': f"leeds_{i+1:04d}",
            'repository': repository,
            'category': f"{case.get('system', '')} Pathology",
            'subcategory': case.get('system', ''),
            'diagnosis': case.get('diagnosis', ''),
            'patient_info': case.get('patient_info', ''),
            'age': age,
            'gender': gender,
            'clinical_history': case.get('clinical_details', ''),
            'stain_type': '',
            'preview_image_url': case.get('preview_image_urls', [''])[0] if case.get('preview_image_urls') else '',
            'slide_url': case.get('slide_urls', [''])[0] if case.get('slide_urls') else '',
            'case_url': '',
            'other_urls': (case.get('slide_urls', [])[1:] if len(case.get('slide_urls', [])) > 1 else []) +
                         (case.get('preview_image_urls', [])[1:] if len(case.get('preview_image_urls', [])) > 1 else []),
            'source_metadata': {
                'system_id': case.get('system_id'),
                'num_slides': case.get('num_slides'),
                'original_data': case
            }
        }
        results.append(result)
    
    return results

def process_mgh(data: List[Dict]) -> List[Dict]:
    """Process MGH Pathology data."""
    results = []
    repository = "MGH Pathology"
    
    for i, case in enumerate(data):
        result = {
            'id': f"mgh_{i+1:04d}",
            'repository': repository,
            'category': case.get('section', ''),
            'subcategory': case.get('subsection', ''),
            'diagnosis': case.get('diagnosis', ''),
            'patient_info': '',
            'age': None,
            'gender': None,
            'clinical_history': case.get('clinical_history', ''),
            'stain_type': '',
            'preview_image_url': case.get('preview_image_url', ''),
            'slide_url': case.get('case_url', ''),
            'case_url': case.get('case_url', ''),
            'other_urls': [],
            'source_metadata': {
                'case_name': case.get('case_name'),
                'requester': case.get('requester'),
                'original_data': case
            }
        }
        results.append(result)
    
    return results

def process_pathpresenter(data: List[Dict]) -> List[Dict]:
    """Process PathPresenter data."""
    results = []
    repository = "PathPresenter"
    
    for case in data:
        result = {
            'id': f"pathpresenter_{case.get('case_id', '')}",
            'repository': repository,
            'category': case.get('category', ''),
            'subcategory': '',
            'diagnosis': case.get('diagnosis', ''),
            'patient_info': '',
            'age': None,
            'gender': None,
            'clinical_history': '',
            'stain_type': case.get('stain', ''),
            'preview_image_url': case.get('image_urls', [''])[0] if case.get('image_urls') else '',
            'slide_url': case.get('case_url', ''),
            'case_url': case.get('case_url', ''),
            'other_urls': case.get('image_urls', [])[1:] if case.get('image_urls') and len(case.get('image_urls', [])) > 1 else [],
            'source_metadata': {
                'case_id': case.get('case_id'),
                'slide_type': case.get('slide_type'),
                'conversion_status': case.get('conversion_status'),
                'original_data': case
            }
        }
        results.append(result)
    
    return results

def process_recutclub(data: List[Dict]) -> List[Dict]:
    """Process Recut Club data."""
    results = []
    repository = "Recut Club"
    
    for i, case in enumerate(data):
        result = {
            'id': f"recutclub_{i+1:04d}",
            'repository': repository,
            'category': case.get('category', ''),
            'subcategory': '',
            'diagnosis': case.get('diagnosis', ''),
            'patient_info': '',
            'age': None,
            'gender': None,
            'clinical_history': case.get('history', ''),
            'stain_type': '',
            'preview_image_url': case.get('image_url', ''),
            'slide_url': case.get('case_url', ''),
            'case_url': case.get('case_url', ''),
            'other_urls': [],
            'source_metadata': {
                'conference': case.get('conference'),
                'case_title': case.get('case_title'),
                'original_data': case
            }
        }
        results.append(result)
    
    return results

def process_rosai(data: List[Dict]) -> List[Dict]:
    """Process Rosai Collection data."""
    results = []
    repository = "Rosai Collection"

    for case in data:
        # Ensure URLs have https:// prefix
        slide_url = case.get('slide_url', '')
        if slide_url and not slide_url.startswith(('http://', 'https://')):
            slide_url = f"https://{slide_url}"

        seminar_url = case.get('seminar_url', '')
        if seminar_url and not seminar_url.startswith(('http://', 'https://')):
            seminar_url = f"https://{seminar_url}"

        result = {
            'id': f"rosai_{case.get('case_id', '')}",
            'repository': repository,
            'category': case.get('category', ''),
            'subcategory': case.get('location', ''),
            'diagnosis': case.get('diagnosis_clean', case.get('diagnosis', '')),
            'patient_info': '',
            'age': None,
            'gender': None,
            'clinical_history': '',
            'stain_type': '',
            'preview_image_url': case.get('thumbnail_url', ''),
            'slide_url': slide_url,
            'case_url': seminar_url,
            'other_urls': [seminar_url],
            'source_metadata': {
                'seminar_title': case.get('seminar_title'),
                'seminar_id': case.get('seminar_id'),
                'case_index': case.get('case_index'),
                'original_data': case
            }
        }
        results.append(result)

    return results

def process_toronto(data: List[Dict]) -> List[Dict]:
    """Process University of Toronto data."""
    results = []
    repository = "University of Toronto LMP"

    for case in data:
        # Convert the case URL to the correct format
        original_url = case.get('case_url', '')
        slide_url = ''
        if original_url:
            # Extract LMP ID and convert to correct format
            # From: https://dlm.lmp.utoronto.ca/image/abdominal-aorta-atherosclerosis-lmp22094
            # To: https://lmpimg.med.utoronto.ca/LMP22094.htm
            lmp_id = case.get('lmp_id', '')
            if lmp_id:
                slide_url = f"https://lmpimg.med.utoronto.ca/{lmp_id.upper()}.htm"
            else:
                # Try to extract LMP ID from URL if not in data
                import re
                lmp_match = re.search(r'lmp(\d+)', original_url.lower())
                if lmp_match:
                    lmp_num = lmp_match.group(1)
                    slide_url = f"https://lmpimg.med.utoronto.ca/LMP{lmp_num}.htm"
                else:
                    slide_url = original_url

        result = {
            'id': f"toronto_{case.get('lmp_id', '')}",
            'repository': repository,
            'category': f"{case.get('organ_system', '')} Pathology",
            'subcategory': case.get('organ_system', ''),
            'diagnosis': case.get('diagnosis', ''),
            'patient_info': f"{case.get('gender', '')} {case.get('age', '')}".strip(),
            'age': case.get('age'),
            'gender': case.get('gender'),
            'clinical_history': '',
            'stain_type': case.get('diagnostic_modality', ''),
            'preview_image_url': case.get('thumbnail_url', ''),
            'slide_url': slide_url,
            'case_url': original_url,
            'other_urls': [case.get('full_image_url', '')],
            'source_metadata': {
                'lmp_id': case.get('lmp_id'),
                'title': case.get('title'),
                'species': case.get('species'),
                'diagnosis_codes': case.get('diagnosis_codes'),
                'original_data': case
            }
        }
        results.append(result)

    return results

def main():
    """Main consolidation function."""
    base_path = Path(__file__).parent
    all_cases = []
    
    # Process each repository
    processors = [
        ('hemepath_etutorial_cases.json', process_hemepath_etutorial),
        ('leeds_cases.json', process_leeds),
        ('mgh_cases.json', process_mgh),
        ('pathpresenter_cases.json', process_pathpresenter),
        ('recutclub_cases.json', process_recutclub),
        ('rosai_cases.json', process_rosai),
        ('toronto_cases.json', process_toronto),
    ]
    
    for filename, processor in processors:
        file_path = base_path / filename
        if file_path.exists():
            print(f"Processing {filename}...")
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            cases = processor(data)
            all_cases.extend(cases)
            print(f"  Added {len(cases)} cases from {filename}")
        else:
            print(f"Warning: {filename} not found")
    
    # Save consolidated data
    output_path = base_path.parent / 'virtual-slides-consolidated.json'
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(all_cases, f, indent=2, ensure_ascii=False)
    
    print(f"\nConsolidation complete!")
    print(f"Total cases: {len(all_cases)}")
    print(f"Output saved to: {output_path}")
    
    # Print summary statistics
    print_summary_stats(all_cases)

def print_summary_stats(cases: List[Dict]):
    """Print summary statistics about the consolidated data."""
    print("\n" + "="*50)
    print("SUMMARY STATISTICS")
    print("="*50)
    
    # Repository counts
    repo_counts = {}
    for case in cases:
        repo = case['repository']
        repo_counts[repo] = repo_counts.get(repo, 0) + 1
    
    print("\nCases by Repository:")
    for repo, count in sorted(repo_counts.items()):
        print(f"  {repo}: {count:,}")
    
    # Categories
    categories = set()
    subcategories = set()
    for case in cases:
        if case['category']:
            categories.add(case['category'])
        if case['subcategory']:
            subcategories.add(case['subcategory'])
    
    print(f"\nUnique Categories ({len(categories)}):")
    for cat in sorted(categories):
        print(f"  - {cat}")
    
    print(f"\nUnique Subcategories/Organ Systems ({len(subcategories)}):")
    for subcat in sorted(subcategories):
        print(f"  - {subcat}")
    
    # Stain types
    stains = set()
    for case in cases:
        if case['stain_type']:
            stains.add(case['stain_type'])
    
    print(f"\nUnique Stain Types ({len(stains)}):")
    for stain in sorted(stains):
        print(f"  - {stain}")

if __name__ == "__main__":
    main()
