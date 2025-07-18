#!/usr/bin/env python3
"""
Standardize Categories and Organ Systems

This script consolidates similar categories and organ systems in the unified virtual slides data.
"""

import json
import re

def standardize_categories():
    """Define category mappings to consolidate similar categories."""
    return {
        # Skin/Dermatology
        'Skin': 'Dermatopathology',
        'Dermatopathology': 'Dermatopathology',
        'Pediatric Dermatopathology': 'Dermatopathology',
        'Mohs': 'Dermatopathology',
        
        # Breast
        'Breast': 'Breast Pathology',
        'Breast Pathology': 'Breast Pathology',
        'Breast (BR)': 'Breast Pathology',
        
        # Gastrointestinal
        'Gastrointestinal': 'Gastrointestinal Pathology',
        'Gastrointestinal Tract': 'Gastrointestinal Pathology',
        'Gastrointestinal Tract (lower) Pathology': 'Gastrointestinal Pathology',
        'Gastrointestinal Tract (upper) Pathology': 'Gastrointestinal Pathology',
        'Gastrointestinal (GI)': 'Gastrointestinal Pathology',
        
        # Head and Neck
        'Head & Neck': 'Head and Neck Pathology',
        'Head And Neck': 'Head and Neck Pathology',
        'Head and Neck': 'Head and Neck Pathology',
        'Head and neck (ENT)': 'Head and Neck Pathology',
        'Eye, ear, nose and throat (ENT) Pathology': 'Head and Neck Pathology',
        'Oral': 'Head and Neck Pathology',
        'Oral Cavity': 'Head and Neck Pathology',
        'Sinonasal and Nasopharynx': 'Head and Neck Pathology',
        'Sinus': 'Head and Neck Pathology',
        'Larynx': 'Head and Neck Pathology',
        'Larynx, Trachea, Hypopharynx': 'Head and Neck Pathology',
        'Neck': 'Head and Neck Pathology',
        'Ear': 'Head and Neck Pathology',
        'Ear and Temporal Bone': 'Head and Neck Pathology',
        'Salivary Gland': 'Head and Neck Pathology',
        'Salivary': 'Head and Neck Pathology',
        'Parotid': 'Head and Neck Pathology',
        
        # Bone and Soft Tissue
        'Bone And Soft Tissue': 'Bone and Soft Tissue Pathology',
        'Bone and Soft Tissue': 'Bone and Soft Tissue Pathology',
        'Bones, Joints, and Soft-Tissue Tumours': 'Bone and Soft Tissue Pathology',
        'Bone and soft tissue (BST)': 'Bone and Soft Tissue Pathology',
        
        # Liver and Pancreas
        'Liver/Pancreatobiliary': 'Hepatopancreatobiliary Pathology',
        'Liver and Biliary Tract': 'Hepatopancreatobiliary Pathology',
        'Liver and Biliary Tract Pathology': 'Hepatopancreatobiliary Pathology',
        'Liver': 'Hepatopancreatobiliary Pathology',
        'Pancreas': 'Hepatopancreatobiliary Pathology',
        'Pancreas Pathology': 'Hepatopancreatobiliary Pathology',
        'Pancreas and Biliary Tree': 'Hepatopancreatobiliary Pathology',
        'Pancreatobiliary': 'Hepatopancreatobiliary Pathology',
        
        # Genitourinary
        'Genitourinary': 'Genitourinary Pathology',
        'Genitourinary Pathology': 'Genitourinary Pathology',
        'Genitourinary (GU)': 'Genitourinary Pathology',
        'Urinary Tract Pathology': 'Genitourinary Pathology',
        'Renal Pathology Pathology': 'Genitourinary Pathology',
        'Renal Pathology': 'Genitourinary Pathology',
        'Kidney': 'Genitourinary Pathology',
        'Kidney and Adrenal Gland': 'Genitourinary Pathology',
        'Bladder': 'Genitourinary Pathology',
        'Prostate': 'Genitourinary Pathology',
        'Testis': 'Genitourinary Pathology',
        'Penis': 'Genitourinary Pathology',
        'Scrotum': 'Genitourinary Pathology',
        'Urethra': 'Genitourinary Pathology',
        'Renal Pelvis and Ureter': 'Genitourinary Pathology',
        'Lower Urinary Tract and Male Genital System': 'Genitourinary Pathology',
        
        # Female Genital Tract
        'Female Genital Tract': 'Gynecologic Pathology',
        'Female Genital Tract Pathology': 'Gynecologic Pathology',
        'Gynecologic': 'Gynecologic Pathology',
        'Gynecologic Pathology': 'Gynecologic Pathology',
        'Gynecologic (GYN)': 'Gynecologic Pathology',
        'Ovary': 'Gynecologic Pathology',
        'Obstetric and Perinatal': 'Gynecologic Pathology',
        'Obstetrics (OB)': 'Gynecologic Pathology',
        'Perinatal': 'Gynecologic Pathology',
        
        # Nervous System
        'Neuro': 'Neuropathology',
        'Central Nervous System': 'Neuropathology',
        'Central Nervous System Pathology': 'Neuropathology',
        'Neuropathology': 'Neuropathology',
        'Peripheral Nerve and Skeletal Muscle': 'Neuropathology',
        'Peripheral Nervous System and Muscle': 'Neuropathology',
        'Peripheral Nervous System and Muscle Pathology': 'Neuropathology',
        
        # Hematopathology
        'Hematopathology': 'Hematopathology',
        'Hematopathology (HP)': 'Hematopathology',
        'White Blood Cells, Lymph Nodes, Spleen, and Thymus': 'Hematopathology',
        'Lymph Nodes': 'Hematopathology',
        'Red Blood Cells and Bleeding Disorders': 'Hematopathology',
        
        # Respiratory
        'Respiratory Tract Pathology': 'Pulmonary Pathology',
        'Respiratory Tract': 'Pulmonary Pathology',
        'Respiratory Tract and Mediastinum': 'Pulmonary Pathology',
        'Thoracic': 'Pulmonary Pathology',
        'Lung': 'Pulmonary Pathology',
        'Pulmonary Pathology': 'Pulmonary Pathology',
        'Pulmonary': 'Pulmonary Pathology',
        
        # Endocrine
        'Endocrine': 'Endocrine Pathology',
        'Endocrine system': 'Endocrine Pathology',
        'Endocrine system Pathology': 'Endocrine Pathology',
        'Endocrine System': 'Endocrine Pathology',
        'Thyroid': 'Endocrine Pathology',
        
        # Eye
        'Eye': 'Ophthalmic Pathology',
        'Eye Pathology': 'Ophthalmic Pathology',
        'Orbit': 'Ophthalmic Pathology',
        'Uvea': 'Ophthalmic Pathology',
        'Retina': 'Ophthalmic Pathology',
        'Conjunctiva': 'Ophthalmic Pathology',
        'Eyelid': 'Ophthalmic Pathology',
        'Lens': 'Ophthalmic Pathology',
        'Optic nerve': 'Ophthalmic Pathology',
        'Cornea': 'Ophthalmic Pathology',
        'Vitreous': 'Ophthalmic Pathology',
        'Orbit and lacrimal gland': 'Ophthalmic Pathology',
        
        # Cardiovascular
        'Heart': 'Cardiovascular Pathology',
        'Cardiac': 'Cardiovascular Pathology',
        'Cardiac Pathology': 'Cardiovascular Pathology',
        'Cardiovascular': 'Cardiovascular Pathology',
        'Cardiovascular (CV)': 'Cardiovascular Pathology',
        'Blood Vessels': 'Cardiovascular Pathology',
        'Vascular': 'Cardiovascular Pathology',
        'Vascular Pathology': 'Cardiovascular Pathology',
        
        # Cytology
        'Cytology': 'Cytopathology',
        'Cytology (Non-gynaecology)': 'Cytopathology',
        'Cytology (Non-gynaecology) Pathology': 'Cytopathology',
        'Cytology (Gynaecology)': 'Cytopathology',
        'Cytology (Gynaecology) Pathology': 'Cytopathology',
        'Cervical and Vaginal Cytology': 'Cytopathology',
        'Urine and Bladder Washings': 'Cytopathology',
        'Pleural, Pericardial, and Peritoneal Fluids': 'Cytopathology',
        'Peritoneal Washings': 'Cytopathology',
        'Cerebrospinal Fluid': 'Cytopathology',
        
        # Pediatric
        'Pediatric': 'Pediatric Pathology',
        'Paediatric Pathology': 'Pediatric Pathology',
        'Paediatric Pathology Pathology': 'Pediatric Pathology',
        
        # General/Others
        'Others': 'General Pathology',
        'General': 'General Pathology',
        'Miscellaneous': 'General Pathology',
    }

def standardize_organ_systems():
    """Define organ system mappings to consolidate similar systems."""
    return {
        # Use the same mappings as categories for consistency
        **standardize_categories(),
        
        # Additional organ system specific mappings
        'Urinary Tract': 'Genitourinary',
        'Gastrointestinal Tract (lower)': 'Gastrointestinal',
        'Gastrointestinal Tract (upper)': 'Gastrointestinal',
    }

def apply_standardization(data, category_mapping, organ_system_mapping):
    """Apply standardization mappings to the data."""
    updated_count = 0
    
    for slide in data:
        # Standardize category
        original_category = slide.get('category', '')
        if original_category in category_mapping:
            slide['category'] = category_mapping[original_category]
            updated_count += 1
        
        # Standardize organ system
        original_organ_system = slide.get('organ_system', '')
        if original_organ_system in organ_system_mapping:
            slide['organ_system'] = organ_system_mapping[original_organ_system]
            updated_count += 1
    
    return updated_count

def main():
    """Main function to standardize categories and organ systems."""
    input_path = "src/data/virtual-slides-unified.json"
    output_path = "src/data/virtual-slides-unified.json"
    
    # Load data
    print("Loading unified virtual slides data...")
    with open(input_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print(f"Loaded {len(data)} slides")
    
    # Get mappings
    category_mapping = standardize_categories()
    organ_system_mapping = standardize_organ_systems()
    
    # Apply standardization
    print("Applying standardization...")
    updated_count = apply_standardization(data, category_mapping, organ_system_mapping)
    
    # Save updated data
    print(f"Saving standardized data...")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print(f"Standardization complete! Updated {updated_count} fields")
    
    # Print new statistics
    categories = {}
    organ_systems = {}
    
    for slide in data:
        cat = slide.get('category', 'Unknown')
        categories[cat] = categories.get(cat, 0) + 1
        
        org = slide.get('organ_system', 'Unknown')
        organ_systems[org] = organ_systems.get(org, 0) + 1
    
    print(f"\n=== STANDARDIZED CATEGORIES ({len(categories)}) ===")
    for cat, count in sorted(categories.items(), key=lambda x: x[1], reverse=True):
        print(f"  {cat}: {count}")
    
    print(f"\n=== STANDARDIZED ORGAN SYSTEMS ({len(organ_systems)}) ===")
    for org, count in sorted(organ_systems.items(), key=lambda x: x[1], reverse=True):
        print(f"  {org}: {count}")

if __name__ == "__main__":
    main()
