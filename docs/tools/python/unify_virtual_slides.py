#!/usr/bin/env python3
"""
Unify Virtual Slides Data

This script processes all virtual slide JSON files and creates a unified structure
for the Virtual Slide Search Engine.
"""

import json
import os
import re
from typing import Dict, List, Any, Optional

def extract_age_gender(patient_info: str) -> tuple[Optional[str], Optional[str]]:
    """Extract age and gender from patient info string."""
    if not patient_info:
        return None, None
    
    # Extract gender
    gender = None
    if 'Female' in patient_info:
        gender = 'Female'
    elif 'Male' in patient_info:
        gender = 'Male'
    
    # Extract age
    age = None
    age_match = re.search(r'(\d+)\s*years?', patient_info)
    if age_match:
        age = f"{age_match.group(1)} years"
    
    return age, gender

def process_leeds_data(data: List[Dict]) -> List[Dict]:
    """Process Leeds Virtual Pathology data."""
    unified_slides = []
    
    for i, item in enumerate(data):
        age, gender = extract_age_gender(item.get('patient_info', ''))
        
        unified_slide = {
            "id": f"leeds_{i+1:04d}",
            "title": item.get('diagnosis', ''),
            "repository": "Leeds University",
            "category": f"{item.get('system', '')} Pathology",
            "organ_system": item.get('system', ''),
            "diagnosis": item.get('diagnosis', ''),
            "clinical_details": item.get('clinical_details', ''),
            "patient_info": item.get('patient_info', ''),
            "slide_urls": item.get('slide_urls', []),
            "preview_image_urls": item.get('preview_image_urls', []),
            "case_url": "",
            "stain": "",
            "specimen_type": "",
            "age": age,
            "gender": gender,
            "source_data": {
                "original_source": "leeds_virtual_pathology",
                "system": item.get('system', ''),
                "system_id": item.get('system_id', '')
            }
        }
        unified_slides.append(unified_slide)
    
    return unified_slides

def process_pathpresenter_data(data: List[Dict], exclude_skin: bool = False) -> List[Dict]:
    """Process PathPresenter Library data."""
    unified_slides = []

    for i, item in enumerate(data):
        # Skip skin cases if exclude_skin is True
        if exclude_skin and item.get('category', '').lower() == 'skin':
            continue

        unified_slide = {
            "id": f"pathpresenter_{i+1:04d}",
            "title": item.get('name', ''),
            "repository": "PathPresenter",
            "category": item.get('category', ''),
            "organ_system": item.get('section', ''),
            "diagnosis": item.get('diagnosis', ''),
            "clinical_details": "",
            "patient_info": "",
            "slide_urls": [],
            "preview_image_urls": item.get('image_urls', []),
            "case_url": item.get('case_url', ''),
            "stain": item.get('stain', ''),
            "specimen_type": item.get('slide_type', ''),
            "age": None,
            "gender": None,
            "source_data": {
                "original_source": "pathpresenter_library",
                "conversion_status": item.get('conversion_status', ''),
                "user_name": item.get('user_name', '')
            }
        }
        unified_slides.append(unified_slide)

    return unified_slides

def process_pathpresenter_skin_data(data: List[Dict]) -> List[Dict]:
    """Process PathPresenter Skin Library data."""
    unified_slides = []

    for i, item in enumerate(data):
        unified_slide = {
            "id": f"pathpresenter_skin_{i+1:04d}",
            "title": item.get('name', ''),
            "repository": "PathPresenter",
            "category": item.get('category', ''),
            "organ_system": item.get('section', ''),
            "diagnosis": item.get('diagnosis', ''),
            "clinical_details": "",
            "patient_info": "",
            "slide_urls": [],
            "preview_image_urls": item.get('image_urls', []),
            "case_url": item.get('case_url', ''),
            "stain": item.get('stain', ''),
            "specimen_type": item.get('slide_type', ''),
            "age": None,
            "gender": None,
            "source_data": {
                "original_source": "pathpresenter_skin_library",
                "conversion_status": item.get('conversion_status', ''),
                "user_name": item.get('user_name', '')
            }
        }
        unified_slides.append(unified_slide)

    return unified_slides

def process_mgh_data(data: List[Dict]) -> List[Dict]:
    """Process MGH Pathology data."""
    unified_slides = []
    
    for i, item in enumerate(data):
        unified_slide = {
            "id": f"mgh_{i+1:04d}",
            "title": item.get('case_name', ''),
            "repository": "MGH Pathology",
            "category": item.get('section', ''),
            "organ_system": item.get('subsection', ''),
            "diagnosis": item.get('diagnosis', ''),
            "clinical_details": item.get('clinical_history', ''),
            "patient_info": "",
            "slide_urls": [],
            "preview_image_urls": [item.get('preview_image_url', '')] if item.get('preview_image_url') else [],
            "case_url": item.get('case_url', ''),
            "stain": "",
            "specimen_type": "",
            "age": None,
            "gender": None,
            "source_data": {
                "original_source": "mgh_pathology",
                "section": item.get('section', ''),
                "subsection": item.get('subsection', ''),
                "requester": item.get('requester', '')
            }
        }
        unified_slides.append(unified_slide)
    
    return unified_slides

def process_toronto_data(data: List[Dict]) -> List[Dict]:
    """Process Toronto Pathology data."""
    unified_slides = []
    
    for i, item in enumerate(data):
        unified_slide = {
            "id": f"toronto_{i+1:04d}",
            "title": item.get('title', ''),
            "repository": "University of Toronto",
            "category": item.get('organ_system', ''),
            "organ_system": item.get('organ_system', ''),
            "diagnosis": item.get('diagnosis', ''),
            "clinical_details": "",
            "patient_info": f"{item.get('gender', '')} {item.get('age', '')}".strip(),
            "slide_urls": [],
            "preview_image_urls": [item.get('thumbnail_url', '')] if item.get('thumbnail_url') else [],
            "case_url": item.get('case_url', ''),
            "stain": "",
            "specimen_type": item.get('diagnostic_modality', ''),
            "age": item.get('age', ''),
            "gender": item.get('gender', ''),
            "source_data": {
                "original_source": "toronto_pathology",
                "lmp_id": item.get('lmp_id', ''),
                "species": item.get('species', ''),
                "diagnosis_codes": item.get('diagnosis_codes', [])
            }
        }
        unified_slides.append(unified_slide)
    
    return unified_slides

def process_hematopathology_data(data: Dict) -> List[Dict]:
    """Process Hematopathology eTutorial data."""
    unified_slides = []
    
    for lesson in data.get('lessons', []):
        for slide in lesson.get('slides', []):
            slide_id = f"hematopathology_{slide.get('id', '').replace('.', '_')}"
            
            unified_slide = {
                "id": slide_id,
                "title": slide.get('title', ''),
                "repository": "Hematopathology eTutorial",
                "category": "Hematopathology",
                "organ_system": "Hematopathology",
                "diagnosis": slide.get('title', ''),
                "clinical_details": f"Lesson {lesson.get('lesson_number', '')}: {lesson.get('title', '')}",
                "patient_info": "",
                "slide_urls": [slide.get('url', '')] if slide.get('url') else [],
                "preview_image_urls": [],
                "case_url": "",
                "stain": "",
                "specimen_type": slide.get('specimen_type', ''),
                "age": None,
                "gender": None,
                "source_data": {
                    "original_source": "hematopathology_etutorial",
                    "lesson_number": lesson.get('lesson_number', ''),
                    "lesson_title": lesson.get('title', ''),
                    "slide_id": slide.get('id', ''),
                    "study_notes": lesson.get('study_notes', '')
                }
            }
            unified_slides.append(unified_slide)
    
    return unified_slides

def main():
    """Main function to process all virtual slide data."""
    base_path = "src/data/virtual-slides"
    output_path = "src/data/virtual-slides-unified.json"
    
    all_unified_slides = []
    
    # Process each data source
    data_sources = [
        ("leeds_virtual_pathology.json", process_leeds_data, {}),
        ("pathpresenter_library.json", process_pathpresenter_data, {"exclude_skin": True}),
        ("pathpresenter_skin_library.json", process_pathpresenter_skin_data, {}),
        ("mgh_pathology.json", process_mgh_data, {}),
        ("toronto_pathology.json", process_toronto_data, {}),
        ("hematopathology_etutorial.json", process_hematopathology_data, {}),
    ]
    
    for filename, processor, kwargs in data_sources:
        file_path = os.path.join(base_path, filename)
        if os.path.exists(file_path):
            print(f"Processing {filename}...")
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)

                unified_data = processor(data, **kwargs)
                all_unified_slides.extend(unified_data)
                print(f"  Added {len(unified_data)} slides from {filename}")
            except json.JSONDecodeError as e:
                print(f"  Error parsing {filename}: {e}")
                print(f"  Skipping {filename}")
            except Exception as e:
                print(f"  Error processing {filename}: {e}")
                print(f"  Skipping {filename}")
        else:
            print(f"Warning: {filename} not found")
    
    # Write unified data
    print(f"\nWriting {len(all_unified_slides)} unified slides to {output_path}")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(all_unified_slides, f, indent=2, ensure_ascii=False)
    
    print("Virtual slides unification complete!")
    
    # Print summary statistics
    repositories = {}
    categories = {}
    organ_systems = {}
    
    for slide in all_unified_slides:
        repo = slide.get('repository', 'Unknown')
        repositories[repo] = repositories.get(repo, 0) + 1
        
        category = slide.get('category', 'Unknown')
        categories[category] = categories.get(category, 0) + 1
        
        organ_system = slide.get('organ_system', 'Unknown')
        organ_systems[organ_system] = organ_systems.get(organ_system, 0) + 1
    
    print("\n=== SUMMARY STATISTICS ===")
    print(f"Total slides: {len(all_unified_slides)}")
    
    print(f"\nRepositories ({len(repositories)}):")
    for repo, count in sorted(repositories.items(), key=lambda x: x[1], reverse=True):
        print(f"  {repo}: {count}")
    
    print(f"\nTop 10 Categories:")
    for category, count in sorted(categories.items(), key=lambda x: x[1], reverse=True)[:10]:
        print(f"  {category}: {count}")
    
    print(f"\nTop 10 Organ Systems:")
    for organ_system, count in sorted(organ_systems.items(), key=lambda x: x[1], reverse=True)[:10]:
        print(f"  {organ_system}: {count}")

if __name__ == "__main__":
    main()
