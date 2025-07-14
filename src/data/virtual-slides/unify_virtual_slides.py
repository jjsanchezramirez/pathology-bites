#!/usr/bin/env python3
"""
Script to unify virtual slide data from multiple sources into a single JSON file.
Standardizes categories and organ systems according to the specified taxonomy.
"""

import json
import os
import re
from typing import Dict, List, Any, Optional
from pathlib import Path

# Standard categories mapping
CATEGORY_MAPPING = {
    # Bone and Soft Tissue
    "bone and soft tissue": "Bone and Soft Tissue",
    "bone": "Bone and Soft Tissue", 
    "soft tissue": "Bone and Soft Tissue",
    "bone and soft tissue (bst)": "Bone and Soft Tissue",
    "musculoskeletal": "Bone and Soft Tissue",
    
    # Breast
    "breast": "Breast",
    "breast pathology": "Breast",
    "breast (br)": "Breast",
    
    # Cardiovascular
    "cardiovascular": "Cardiovascular",
    "cardiovascular (cv)": "Cardiovascular",
    "cardiac": "Cardiovascular",
    "heart": "Cardiovascular",
    "blood vessels": "Cardiovascular",
    
    # Cyto
    "cytology": "Cyto",
    "cyto": "Cyto",
    "cytopathology": "Cyto",
    
    # Derm
    "dermatology": "Derm",
    "derm": "Derm",
    "dermatopathology": "Derm",
    "skin": "Derm",
    
    # Endocrine
    "endocrine": "Endocrine",
    "endocrinology": "Endocrine",
    "thyroid": "Endocrine",
    "adrenal": "Endocrine",
    "pituitary": "Endocrine",
    
    # GI
    "gastrointestinal": "GI",
    "gi": "GI",
    "gastroenterology": "GI",
    "liver": "GI",
    "stomach": "GI",
    "colon": "GI",
    "intestine": "GI",
    
    # General
    "general": "General",
    "general pathology": "General",
    "basic": "General",
    
    # GU
    "genitourinary": "GU",
    "gu": "GU",
    "urogenital": "GU",
    "kidney": "GU",
    "bladder": "GU",
    "prostate": "GU",
    
    # Gyn
    "gynecology": "Gyn",
    "gyn": "Gyn",
    "gynecologic": "Gyn",
    "ovary": "Gyn",
    "uterus": "Gyn",
    "cervix": "Gyn",
    
    # Head and Neck
    "head and neck": "Head and Neck",
    "head & neck": "Head and Neck",
    "ent": "Head and Neck",
    "oral": "Head and Neck",
    "salivary": "Head and Neck",
    
    # Hemepath
    "hematopathology": "Hemepath",
    "hemepath": "Hemepath",
    "hematology": "Hemepath",
    "blood": "Hemepath",
    "bone marrow": "Hemepath",
    "lymph node": "Hemepath",
    "spleen": "Hemepath",
    
    # Hepatobiliary and Pancreas
    "hepatobiliary": "Hepatobiliary and Pancreas",
    "pancreas": "Hepatobiliary and Pancreas",
    "liver": "Hepatobiliary and Pancreas",
    "gallbladder": "Hepatobiliary and Pancreas",
    "bile duct": "Hepatobiliary and Pancreas",
    
    # Neuro
    "neuropathology": "Neuro",
    "neuro": "Neuro",
    "brain": "Neuro",
    "nervous system": "Neuro",
    "cns": "Neuro",
    
    # Ophthalmic
    "ophthalmology": "Ophthalmic",
    "ophthalmic": "Ophthalmic",
    "eye": "Ophthalmic",
    "ocular": "Ophthalmic",
    
    # Peds
    "pediatric": "Peds",
    "peds": "Peds",
    "pediatrics": "Peds",
    "perinatal": "Peds",
    
    # Pulmonary/Thoracic
    "pulmonary": "Pulmonary/Thoracic",
    "thoracic": "Pulmonary/Thoracic",
    "lung": "Pulmonary/Thoracic",
    "respiratory": "Pulmonary/Thoracic",
    "pleura": "Pulmonary/Thoracic",
}

# Organ system mapping
ORGAN_SYSTEM_MAPPING = {
    # Cardiovascular
    "blood vessels": "cardiovascular",
    "heart": "cardiovascular", 
    "aorta": "cardiovascular",
    "artery": "cardiovascular",
    "vein": "cardiovascular",
    
    # Respiratory
    "lung": "lungs",
    "lungs": "lungs",
    "pleura": "lungs",
    "bronchus": "lungs",
    
    # GI
    "stomach": "stomach",
    "colon": "colon",
    "small intestine": "small intestine",
    "esophagus": "esophagus",
    "liver": "liver",
    "pancreas": "pancreas",
    "gallbladder": "gallbladder",
    
    # GU
    "kidney": "kidney",
    "bladder": "bladder", 
    "prostate": "prostate",
    "testis": "testis",
    "penis": "penis",
    
    # Gyn
    "ovary": "ovaries",
    "ovaries": "ovaries",
    "uterus": "uterus",
    "cervix": "cervix",
    "fallopian tube": "fallopian tubes",
    
    # Other
    "breast": "breast",
    "skin": "skin",
    "bone": "bone",
    "soft tissue": "soft tissue",
    "lymph node": "lymph nodes",
    "spleen": "spleen",
    "thyroid": "thyroid",
    "adrenal": "adrenal",
    "brain": "brain",
    "eye": "eye",
    "bone marrow": "bone marrow",
    "blood": "blood",
}

def normalize_category(category: str) -> str:
    """Normalize category to standard taxonomy."""
    if not category:
        return "General"
    
    category_lower = category.lower().strip()
    return CATEGORY_MAPPING.get(category_lower, category.title())

def normalize_organ_system(organ_system: str) -> str:
    """Normalize organ system to standard taxonomy.""" 
    if not organ_system:
        return ""
    
    organ_lower = organ_system.lower().strip()
    return ORGAN_SYSTEM_MAPPING.get(organ_lower, organ_system.lower())

def extract_age_gender(patient_info: str) -> tuple:
    """Extract age and gender from patient info string."""
    age = ""
    gender = None
    
    if not patient_info:
        return age, gender
    
    # Extract age
    age_match = re.search(r'(\d+(?:\.\d+)?)\s*(?:years?|yrs?|months?|days?|weeks?)', patient_info.lower())
    if age_match:
        age_num = age_match.group(1)
        if 'month' in patient_info.lower():
            age = f"{age_num} months"
        elif 'day' in patient_info.lower():
            age = f"{age_num} days"
        elif 'week' in patient_info.lower():
            age = f"{age_num} weeks"
        else:
            age = f"{age_num} years"
    
    # Extract gender
    if 'female' in patient_info.lower():
        gender = "Female"
    elif 'male' in patient_info.lower():
        gender = "Male"
    
    return age, gender

def process_leeds_data(data: List[Dict]) -> List[Dict]:
    """Process Leeds Virtual Pathology data."""
    unified_cases = []
    
    for i, case in enumerate(data):
        age, gender = extract_age_gender(case.get('patient_info', ''))
        
        unified_case = {
            "id": f"leeds_{i+1:04d}",
            "title": case.get('diagnosis', ''),
            "repository": "Leeds University",
            "category": normalize_category("Breast Pathology"),  # Most Leeds cases are breast
            "organ_system": normalize_organ_system("breast"),
            "diagnosis": case.get('diagnosis', ''),
            "clinical_details": case.get('clinical_details', ''),
            "patient_info": case.get('patient_info', ''),
            "slide_urls": case.get('slide_urls', []),
            "preview_image_urls": case.get('preview_image_urls', []),
            "case_url": "",
            "stain": "",
            "specimen_type": "",
            "age": age,
            "gender": gender,
            "source_data": {
                "original_source": "leeds_virtual_pathology",
                "system": case.get('system', ''),
                "system_id": case.get('system_id', '')
            }
        }
        unified_cases.append(unified_case)
    
    return unified_cases

def process_mgh_data(data: List[Dict]) -> List[Dict]:
    """Process MGH Pathology data."""
    unified_cases = []
    
    for i, case in enumerate(data):
        # Extract category from subsection
        subsection = case.get('subsection', '')
        category = normalize_category(subsection.split('(')[0].strip() if '(' in subsection else subsection)
        
        unified_case = {
            "id": f"mgh_{i+1:04d}",
            "title": case.get('diagnosis', ''),
            "repository": "MGH Pathology",
            "category": category,
            "organ_system": normalize_organ_system(category.lower()),
            "diagnosis": case.get('diagnosis', ''),
            "clinical_details": case.get('clinical_history', ''),
            "patient_info": "",
            "slide_urls": [],
            "preview_image_urls": [case.get('preview_image_url', '')] if case.get('preview_image_url') else [],
            "case_url": case.get('case_url', ''),
            "stain": "",
            "specimen_type": "",
            "age": "",
            "gender": None,
            "source_data": {
                "original_source": "mgh_pathology",
                "section": case.get('section', ''),
                "subsection": case.get('subsection', ''),
                "case_name": case.get('case_name', ''),
                "requester": case.get('requester', '')
            }
        }
        unified_cases.append(unified_case)
    
    return unified_cases

def process_pathpresenter_data(data: List[Dict]) -> List[Dict]:
    """Process PathPresenter Library data."""
    unified_cases = []

    for i, case in enumerate(data):
        category = normalize_category(case.get('category', case.get('section', '')))

        unified_case = {
            "id": f"pathpresenter_{i+1:04d}",
            "title": case.get('name', ''),
            "repository": "PathPresenter",
            "category": category,
            "organ_system": normalize_organ_system(category.lower()),
            "diagnosis": case.get('diagnosis', ''),
            "clinical_details": "",
            "patient_info": "",
            "slide_urls": [],
            "preview_image_urls": case.get('image_urls', []),
            "case_url": case.get('case_url', ''),
            "stain": case.get('stain', ''),
            "specimen_type": case.get('slide_type', ''),
            "age": "",
            "gender": None,
            "source_data": {
                "original_source": "pathpresenter_library",
                "case_id": case.get('case_id', ''),
                "user_name": case.get('user_name', ''),
                "conversion_status": case.get('conversion_status', '')
            }
        }
        unified_cases.append(unified_case)

    return unified_cases

def process_rosai_data(data: List[Dict]) -> List[Dict]:
    """Process Rosai Collection data."""
    unified_cases = []

    for i, case in enumerate(data):
        category = normalize_category(case.get('category', ''))

        unified_case = {
            "id": f"rosai_{i+1:04d}",
            "title": case.get('diagnosis_clean', case.get('diagnosis', '')),
            "repository": "Rosai Collection",
            "category": category,
            "organ_system": normalize_organ_system(case.get('location', '').lower()),
            "diagnosis": case.get('diagnosis_clean', case.get('diagnosis', '')),
            "clinical_details": case.get('description', ''),
            "patient_info": "",
            "slide_urls": [case.get('slide_url', '')] if case.get('slide_url') else [],
            "preview_image_urls": [case.get('thumbnail_url', '')] if case.get('thumbnail_url') else [],
            "case_url": case.get('seminar_url', ''),
            "stain": "",
            "specimen_type": "",
            "age": "",
            "gender": None,
            "source_data": {
                "original_source": "rosai_collection_library",
                "seminar_id": case.get('seminar_id', ''),
                "seminar_title": case.get('seminar_title', ''),
                "case_id": case.get('case_id', ''),
                "location": case.get('location', '')
            }
        }
        unified_cases.append(unified_case)

    return unified_cases

def process_toronto_data(data: List[Dict]) -> List[Dict]:
    """Process University of Toronto LMP data."""
    unified_cases = []

    for i, case in enumerate(data):
        age, gender = extract_age_gender(f"{case.get('gender', '')} {case.get('age', '')}")
        organ_system = normalize_organ_system(case.get('organ_system', ''))
        category = normalize_category(organ_system)

        unified_case = {
            "id": f"toronto_{i+1:04d}",
            "title": case.get('title', ''),
            "repository": "University of Toronto LMP",
            "category": category,
            "organ_system": organ_system,
            "diagnosis": case.get('diagnosis', ''),
            "clinical_details": "",
            "patient_info": f"{case.get('gender', '')} {case.get('age', '')}".strip(),
            "slide_urls": [],
            "preview_image_urls": [case.get('thumbnail_url', '')] if case.get('thumbnail_url') else [],
            "case_url": case.get('case_url', ''),
            "stain": "",
            "specimen_type": case.get('diagnostic_modality', ''),
            "age": case.get('age', ''),
            "gender": case.get('gender'),
            "source_data": {
                "original_source": "toronto_pathology",
                "lmp_id": case.get('lmp_id', ''),
                "species": case.get('species', ''),
                "diagnosis_codes": case.get('diagnosis_codes', [])
            }
        }
        unified_cases.append(unified_case)

    return unified_cases

def process_hematopathology_data(data: Dict) -> List[Dict]:
    """Process Hematopathology eTutorial data."""
    unified_cases = []
    case_id = 1

    for lesson in data.get('lessons', []):
        lesson_number = lesson.get('lesson_number', 0)
        lesson_title = lesson.get('title', '')

        for slide in lesson.get('slides', []):
            unified_case = {
                "id": f"hemepath_{case_id:04d}",
                "title": slide.get('title', ''),
                "repository": "Hematopathology eTutorial",
                "category": "Hemepath",
                "organ_system": normalize_organ_system(slide.get('specimen_type', 'blood')),
                "diagnosis": slide.get('title', ''),
                "clinical_details": f"Lesson {lesson_number}: {lesson_title}",
                "patient_info": "",
                "slide_urls": [f"https://hematopathology.com{slide.get('url', '')}"] if slide.get('url') else [],
                "preview_image_urls": [],
                "case_url": "",
                "stain": "",
                "specimen_type": slide.get('specimen_type', ''),
                "age": "",
                "gender": None,
                "source_data": {
                    "original_source": "hematopathology_etutorial",
                    "lesson_number": lesson_number,
                    "lesson_title": lesson_title,
                    "slide_id": slide.get('id', ''),
                    "study_notes": lesson.get('study_notes', '')
                }
            }
            unified_cases.append(unified_case)
            case_id += 1

    return unified_cases

def main():
    """Main function to unify all virtual slide data sources."""
    script_dir = Path(__file__).parent
    unified_cases = []

    # Process each data source
    data_sources = [
        ('leeds_virtual_pathology.json', process_leeds_data),
        ('mgh_pathology.json', process_mgh_data),
        ('pathpresenter_library.json', process_pathpresenter_data),
        ('rosai_collection_library.json', process_rosai_data),
        ('toronto_pathology.json', process_toronto_data),
        ('hematopathology_etutorial.json', process_hematopathology_data),
    ]

    for filename, processor in data_sources:
        file_path = script_dir / filename
        if file_path.exists():
            print(f"Processing {filename}...")
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)

                processed_cases = processor(data)
                unified_cases.extend(processed_cases)
                print(f"  Added {len(processed_cases)} cases from {filename}")
            except Exception as e:
                print(f"  Error processing {filename}: {e}")
        else:
            print(f"  Warning: {filename} not found")

    # Write unified data
    output_path = script_dir.parent / 'virtual-slides-unified.json'
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(unified_cases, f, indent=2, ensure_ascii=False)

    print(f"\nUnified {len(unified_cases)} cases into {output_path}")

    # Print category and organ system statistics
    categories = {}
    organ_systems = {}

    for case in unified_cases:
        cat = case.get('category', 'Unknown')
        org = case.get('organ_system', 'Unknown')

        categories[cat] = categories.get(cat, 0) + 1
        organ_systems[org] = organ_systems.get(org, 0) + 1

    print(f"\nCategories found ({len(categories)}):")
    for cat, count in sorted(categories.items()):
        print(f"  {cat}: {count}")

    print(f"\nOrgan systems found ({len(organ_systems)}):")
    for org, count in sorted(organ_systems.items()):
        print(f"  {org}: {count}")

if __name__ == "__main__":
    main()
