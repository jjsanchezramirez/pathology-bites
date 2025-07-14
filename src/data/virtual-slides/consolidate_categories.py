#!/usr/bin/env python3
"""
Script to consolidate categories and organ systems in the unified virtual slides data.
Maps all categories to the standard taxonomy and consolidates organ systems.
"""

import json
import re
from typing import Dict, List, Any
from pathlib import Path

# Standard categories (target taxonomy)
STANDARD_CATEGORIES = {
    "Bone and Soft Tissue",
    "Breast", 
    "Cardiovascular",
    "Cyto",
    "Derm",
    "Endocrine",
    "GI",
    "General",
    "GU", 
    "Gyn",
    "Head and Neck",
    "Hemepath",
    "Hepatobiliary and Pancreas",
    "Neuro",
    "Ophthalmic",
    "Peds",
    "Pulmonary/Thoracic"
}

# Comprehensive category consolidation mapping
CATEGORY_CONSOLIDATION = {
    # Bone and Soft Tissue
    "Acute Insults": "Bone and Soft Tissue",
    "Benign Bone-Forming Tumors": "Bone and Soft Tissue",
    "Benign Cartilage Tumors": "Bone and Soft Tissue", 
    "Bones, Joints, And Soft-Tissue Tumours": "Bone and Soft Tissue",
    "Cystic Lesions Of Bone": "Bone and Soft Tissue",
    "Fibrous And Fibrohistiocytic Tumors": "Bone and Soft Tissue",
    "Giant Cell-Rich Tumors": "Bone and Soft Tissue",
    "Hematopoietic Tumors": "Bone and Soft Tissue",
    "Malignant Bone-Forming Tumors": "Bone and Soft Tissue",
    "Malignant Cartilage Tumors": "Bone and Soft Tissue",
    "Malignant Small Round Cell Tumors": "Bone and Soft Tissue",
    "Miscellaneous Mesenchymal Tumors": "Bone and Soft Tissue",
    "Notochordal Tumors": "Bone and Soft Tissue",
    "Soft Tissues": "Bone and Soft Tissue",
    "Tumors": "Bone and Soft Tissue",
    "Vascular Tumors": "Bone and Soft Tissue",
    
    # Breast (already correct)
    
    # Cardiovascular (already correct)
    
    # Cyto (already correct)
    
    # Derm
    "Benign Pigmented Lesions": "Derm",
    "Cutaneous Lymphomas And Leukemias": "Derm",
    "Cutaneous Toxicities Of Drugs": "Derm",
    "Degerative, Perforating And Nutritional Diseases": "Derm",
    "Erythematous, Papular And Squamous Diseases": "Derm",
    "Histiocytoses": "Derm",
    "Inflammatory Dz Of Epid Appendages And Cartilage": "Derm",
    "Malignant Melanoma": "Derm",
    "Metabolic Diseases Of The Skin": "Derm",
    "Metastatic Carcinoma Of The Skin": "Derm",
    "Mimicry In Melanocytic Lesions": "Derm",
    "Non-Infectious And Palisading Granulomas": "Derm",
    "Normal Skin": "Derm",
    "Panniculitis": "Derm",
    "Pediatric Dermatopathology": "Derm",
    "Photosentivity And Physical Agents": "Derm",
    "Tumors And Cysts Of The Epidermis": "Derm",
    "Tumors Of Fatty, Osseous And Muscular Tissue": "Derm",
    "Tumors Of Fibrous Tissue": "Derm",
    "Tumors Of Neural Tissue": "Derm",
    "Tumors Of The Epidermal Appendages": "Derm",
    "Vascular Diseases": "Derm",
    "Vesiculobullous And Vesiculopustular Diseases": "Derm",
    "Viral Diseases": "Derm",
    "Fungal, Protozoal And Parasitic Diseases": "Derm",
    "Bacterial, Mycobacterial, And Treponemal Diseases": "Derm",
    "Infective Diseases": "Derm",
    
    # Endocrine
    "Endocrine System": "Endocrine",
    
    # GI
    "Gastrointestinal Tract": "GI",
    "Gi-Tract": "GI",
    
    # General (already correct)
    "Miscellaneous": "General",
    "Others": "General",
    "Congenital Diseases": "General",
    "Connective Tissue Diseases": "General",
    "Metastatic Tumors": "General",
    
    # GU
    "Lower Urinary Tract And Male Genital System": "GU",
    "Kidney And Adrenal Gland": "GU",
    "Renal Pelvis And Ureter": "GU",
    "Uropathology": "GU",
    "Penis": "GU",
    "Scrotum": "GU",
    "Testis": "GU",
    "Urethra": "GU",
    
    # Gyn
    "Female Genital Tract": "Gyn",
    "Obstetrics": "Gyn",
    "Fetal Vascular Malperfusion": "Gyn",
    "Maternal Vascular Malperfusion": "Gyn",
    "Miscellaneous Placental Pathology": "Gyn",
    "Placental Infections": "Gyn",
    "Placental Pathologies With Recurrence Risk": "Gyn",
    "Trophoblastic Pathology": "Gyn",
    "Ovary - Germ Cell Tumors - Mixed": "Gyn",
    "Ovary - Germ Cell Tumors - Monodermal Teratomas": "Gyn",
    "Ovary - Germ Cell Tumors - Primitive": "Gyn",
    "Ovary - Germ Cell Tumors - Teratoma With Somatic Type Tumor": "Gyn",
    "Ovary - Germ Cell Tumors - Teratomas": "Gyn",
    
    # Head and Neck
    "Ear": "Head and Neck",
    "Ear And Temporal Bone": "Head and Neck",
    "Larynx": "Head and Neck",
    "Larynx, Trachea, Hypopharynx": "Head and Neck",
    "Neck": "Head and Neck",
    "Oral Cavity": "Head and Neck",
    "Oral Pathology": "Head and Neck",
    "Parotid": "Head and Neck",
    "Salivary Gland": "Head and Neck",
    "Salivary - Acinic Cell Carcinoma": "Head and Neck",
    "Salivary - Adenoid Cystic": "Head and Neck",
    "Salivary - Basal Cell Carcinoma": "Head and Neck",
    "Salivary - Intraductal Carcinoma": "Head and Neck",
    "Salivary - Lymphoepithelial Carcinoma": "Head and Neck",
    "Salivary - Mec": "Head and Neck",
    "Salivary - Miscellaneous": "Head and Neck",
    "Salivary - Mucoepidermoid": "Head and Neck",
    "Salivary - Oncocytoma": "Head and Neck",
    "Salivary - Pleomorphic Adenoma": "Head and Neck",
    "Salivary - Polymorphous Adenocarcinoma": "Head and Neck",
    "Salivary - Secretory Carcinoma": "Head and Neck",
    "Salivary - Squamous Cell Carcinoma": "Head and Neck",
    "Sinonasal And Nasopharynx": "Head and Neck",
    "Sinus": "Head and Neck",
    
    # Hemepath
    "Cerebrospinal Fluid": "Hemepath",
    "Lymph Nodes": "Hemepath",
    "Pleural, Pericardial, And Peritoneal Fluids": "Hemepath",
    "Peritoneal Washings": "Hemepath",
    "Red Blood Cells And Bleeding Disorders": "Hemepath",
    "Urine And Bladder Washings": "Hemepath",
    "White Blood Cells, Lymph Nodes, Spleen, And Thymus": "Hemepath",
    
    # Hepatobiliary and Pancreas
    "Liver And Biliary Tract": "Hepatobiliary and Pancreas",
    "Liver/Pancreatobiliary": "Hepatobiliary and Pancreas",
    "Pancreas And Biliary Tree": "Hepatobiliary and Pancreas",
    "Pancreatobiliary": "Hepatobiliary and Pancreas",
    
    # Neuro
    "Central Nervous System": "Neuro",
    "Peripheral Nerve And Skeletal Muscle": "Neuro",
    
    # Ophthalmic
    "Conjunctiva": "Ophthalmic",
    "Cornea": "Ophthalmic",
    "Eyelid": "Ophthalmic",
    "Lens": "Ophthalmic",
    "Optic Nerve": "Ophthalmic",
    "Orbit": "Ophthalmic",
    "Orbit And Lacrimal Gland": "Ophthalmic",
    "Retina": "Ophthalmic",
    "Uvea": "Ophthalmic",
    "Vitreous": "Ophthalmic",
    
    # Peds
    "Paidopathology": "Peds",
    
    # Pulmonary/Thoracic
    "Lungs": "Pulmonary/Thoracic",
    "Pulmonary Pathology": "Pulmonary/Thoracic",
    "Respiratory Tract": "Pulmonary/Thoracic",
    "Respiratory Tract And Mediastinum": "Pulmonary/Thoracic",
    
    # Cyto
    "Cervical And Vaginal Cytology": "Cyto",
}

# Standard organ systems (simplified)
ORGAN_SYSTEM_CONSOLIDATION = {
    # Cardiovascular
    "blood vessels": "cardiovascular",
    "heart": "cardiovascular",
    "aorta": "cardiovascular", 
    "cardiovascular": "cardiovascular",
    
    # Respiratory
    "lung": "lungs",
    "lungs": "lungs",
    "pleura": "lungs",
    "respiratory": "lungs",
    
    # GI
    "stomach": "stomach",
    "colon": "colon", 
    "large bowel": "colon",
    "small bowel": "small intestine",
    "small intestine": "small intestine",
    "intestine": "small intestine",
    "esophagus": "esophagus",
    "liver": "liver",
    "pancreas": "pancreas",
    "gallbladder": "gallbladder",
    "gi": "gastrointestinal",
    "gastrointestinal tract": "gastrointestinal",
    
    # GU
    "kidney": "kidney",
    "bladder": "bladder",
    "prostate": "prostate", 
    "testis": "testis",
    "penis": "penis",
    "gu": "genitourinary",
    
    # Gyn
    "ovary": "ovaries",
    "ovaries": "ovaries",
    "uterus": "uterus",
    "cervix": "cervix",
    "fallopian tube": "fallopian tubes",
    "fallopian tubes": "fallopian tubes",
    "gyn": "gynecologic",
    
    # Other major systems
    "breast": "breast",
    "skin": "skin",
    "bone": "bone",
    "soft tissue": "soft tissue",
    "soft tissues": "soft tissue",
    "lymph node": "lymph nodes",
    "lymph nodes": "lymph nodes",
    "spleen": "spleen",
    "thyroid": "thyroid",
    "adrenal": "adrenal",
    "brain": "brain",
    "cns": "brain",
    "eye": "eye",
    "bone marrow": "bone marrow",
    "blood": "blood",
    "hemepath": "hematologic",
    "endocrine": "endocrine",
    "neuro": "neurologic",
    "derm": "dermatologic",
    "head and neck": "head and neck",
    "oral cavity": "head and neck",
    "salivary gland": "head and neck",
    "salivary glands": "head and neck",
    "nasal cavity": "head and neck",
    "larynx": "head and neck",
    "neck": "head and neck",
    "ear": "head and neck",
    "ophthalmic": "ophthalmic",
    "peds": "pediatric",
    "general": "general",
}

def consolidate_category(category: str) -> str:
    """Consolidate category to standard taxonomy."""
    if not category:
        return "General"
    
    # Direct mapping
    if category in CATEGORY_CONSOLIDATION:
        return CATEGORY_CONSOLIDATION[category]
    
    # If already in standard categories, keep it
    if category in STANDARD_CATEGORIES:
        return category
    
    # Default fallback
    return "General"

def consolidate_organ_system(organ_system: str) -> str:
    """Consolidate organ system to simplified taxonomy."""
    if not organ_system:
        return ""

    organ_lower = organ_system.lower().strip()

    # Skip very specific/technical terms and return empty
    skip_terms = [
        "?", "vs", "with", "grade", "type", "cell", "tumor", "carcinoma", "adenoma",
        "sarcoma", "lymphoma", "melanoma", "called", "so-called", "variant", "like",
        "positive", "negative", "associated", "related", "differentiated", "undifferentiated",
        "malignant", "benign", "primary", "metastatic", "recurrent", "typical", "atypical",
        "well-", "poorly", "high", "low", "grade", "stage", "phase", "acute", "chronic",
        "inflammatory", "infectious", "viral", "bacterial", "fungal", "parasitic",
        "congenital", "acquired", "hereditary", "familial", "sporadic", "idiopathic",
        "proliferating", "proliferative", "hyperplastic", "dysplastic", "neoplastic",
        "cystic", "solid", "mixed", "composite", "complex", "simple", "multiple", "single",
        "bilateral", "unilateral", "left", "right", "upper", "lower", "anterior", "posterior",
        "medial", "lateral", "proximal", "distal", "superficial", "deep", "subcutaneous",
        "intra-", "extra-", "peri-", "para-", "supra-", "infra-", "retro-", "pre-", "post-",
        "micro-", "macro-", "mini-", "maxi-", "pseudo-", "semi-", "multi-", "poly-",
        "hyper-", "hypo-", "mega-", "giga-", "nano-", "ultra-", "trans-", "inter-",
        "jrc:", "mrn:", "abc", "cmv", "ebv", "hiv", "uip", "ump", "dic", "mfh", "gist",
        "scuc", "oat", "plus", "minus", "negative", "positive", "unknown", "doubt",
        "probably", "possibly", "likely", "unlikely", "suspected", "confirmed", "ruled out"
    ]

    # If contains skip terms, return empty
    if any(term in organ_lower for term in skip_terms):
        return ""

    # Direct mapping
    if organ_lower in ORGAN_SYSTEM_CONSOLIDATION:
        return ORGAN_SYSTEM_CONSOLIDATION[organ_lower]

    # Pattern matching for complex organ systems
    if any(term in organ_lower for term in ["lung", "respiratory", "pleura", "bronch", "alveol", "pulmonary"]):
        return "lungs"
    elif any(term in organ_lower for term in ["heart", "cardiac", "aorta", "vessel", "vascular", "artery", "vein", "atrium", "ventricle"]):
        return "cardiovascular"
    elif any(term in organ_lower for term in ["stomach", "gastric", "pylorus"]):
        return "stomach"
    elif any(term in organ_lower for term in ["colon", "large bowel", "rectum", "sigmoid", "cecum", "anus", "anal"]):
        return "colon"
    elif any(term in organ_lower for term in ["small bowel", "small intestine", "duodenum", "jejunum", "ileum", "intestin"]):
        return "small intestine"
    elif any(term in organ_lower for term in ["esophag"]):
        return "esophagus"
    elif any(term in organ_lower for term in ["kidney", "renal", "nephro"]):
        return "kidney"
    elif any(term in organ_lower for term in ["bladder", "vesical"]):
        return "bladder"
    elif any(term in organ_lower for term in ["urethra", "urethral"]):
        return "urethra"
    elif any(term in organ_lower for term in ["prostate", "prostatic"]):
        return "prostate"
    elif any(term in organ_lower for term in ["testis", "testicle", "testicular", "spermatic", "epididym", "scrotal", "scrotum"]):
        return "testis"
    elif any(term in organ_lower for term in ["penis", "penile"]):
        return "penis"
    elif any(term in organ_lower for term in ["ovary", "ovaries", "ovarian"]):
        return "ovaries"
    elif any(term in organ_lower for term in ["uterus", "uterine", "endometrium", "endometrial", "myometrium", "corpus"]):
        return "uterus"
    elif any(term in organ_lower for term in ["cervix", "cervical"]):
        return "cervix"
    elif any(term in organ_lower for term in ["fallopian", "tube", "adnex"]):
        return "fallopian tubes"
    elif any(term in organ_lower for term in ["vagina", "vaginal"]):
        return "vagina"
    elif any(term in organ_lower for term in ["vulva", "vulvar"]):
        return "vulva"
    elif any(term in organ_lower for term in ["placenta", "placental", "trophoblast"]):
        return "placenta"
    elif any(term in organ_lower for term in ["breast", "mammary", "nipple"]):
        return "breast"
    elif any(term in organ_lower for term in ["skin", "cutaneous", "dermal", "epidermal", "subcutaneous", "scalp", "face", "neck", "arm", "leg", "back", "chest", "abdomen", "thigh", "foot", "hand", "finger", "toe", "forehead", "cheek", "chin", "nose", "ear", "lip"]):
        return "skin"
    elif any(term in organ_lower for term in ["bone", "skeletal", "osseous", "femur", "tibia", "humerus", "radius", "ulna", "fibula", "scapula", "clavicle", "sternum", "rib", "vertebra", "skull", "mandible", "maxilla", "pelvis", "sacrum", "coccyx"]):
        return "bone"
    elif any(term in organ_lower for term in ["soft tissue", "muscle", "tendon", "ligament", "fascia", "connective", "mesenchym", "stromal", "fibrous", "adipose", "fat"]):
        return "soft tissue"
    elif any(term in organ_lower for term in ["lymph", "node", "spleen", "splenic"]):
        return "lymph nodes"
    elif any(term in organ_lower for term in ["thymus", "thymic"]):
        return "thymus"
    elif any(term in organ_lower for term in ["thyroid"]):
        return "thyroid"
    elif any(term in organ_lower for term in ["parathyroid"]):
        return "parathyroid"
    elif any(term in organ_lower for term in ["adrenal", "suprarenal"]):
        return "adrenal"
    elif any(term in organ_lower for term in ["pituitary", "hypophys"]):
        return "pituitary"
    elif any(term in organ_lower for term in ["brain", "cerebr", "cns", "neural", "neuro", "cranial", "intracranial", "meninges", "dura", "ventricle", "pineal"]):
        return "brain"
    elif any(term in organ_lower for term in ["spinal", "cord", "spine"]):
        return "spinal cord"
    elif any(term in organ_lower for term in ["nerve", "peripheral"]):
        return "peripheral nerve"
    elif any(term in organ_lower for term in ["eye", "ocular", "ophthalmic", "retina", "cornea", "lens", "vitreous", "uvea", "conjunctiva", "orbit", "lacrimal"]):
        return "eye"
    elif any(term in organ_lower for term in ["blood", "hematologic", "hemato", "leukemia", "lymphoma"]):
        return "blood"
    elif any(term in organ_lower for term in ["bone marrow", "marrow"]):
        return "bone marrow"
    elif any(term in organ_lower for term in ["liver", "hepatic", "hepato"]):
        return "liver"
    elif any(term in organ_lower for term in ["gallbladder", "bile", "biliary", "cholangio"]):
        return "gallbladder"
    elif any(term in organ_lower for term in ["pancreas", "pancreatic", "islet"]):
        return "pancreas"
    elif any(term in organ_lower for term in ["oral", "mouth", "tongue", "gingiva", "palate", "tonsil", "pharynx", "larynx", "vocal", "salivary", "parotid", "submandibular", "sublingual"]):
        return "head and neck"
    elif any(term in organ_lower for term in ["nasal", "sinus", "nasopharynx", "sinonasal"]):
        return "head and neck"
    elif any(term in organ_lower for term in ["mediastin", "pleura", "pericardium", "peritoneum", "omentum", "mesentery"]):
        return "serosal surfaces"
    elif any(term in organ_lower for term in ["general", "miscellaneous", "others", "unknown"]):
        return ""

    # If it's a very short, clean term, keep it
    if len(organ_lower) <= 15 and organ_lower.isalpha():
        return organ_lower

    # Otherwise return empty string
    return ""

def main():
    """Main function to consolidate categories and organ systems."""
    script_dir = Path(__file__).parent
    input_path = script_dir.parent / 'virtual-slides-unified.json'
    output_path = script_dir.parent / 'virtual-slides-unified.json'
    
    print(f"Loading data from {input_path}...")
    with open(input_path, 'r', encoding='utf-8') as f:
        cases = json.load(f)
    
    print(f"Processing {len(cases)} cases...")
    
    # Track changes
    category_changes = {}
    organ_changes = {}
    
    for case in cases:
        # Consolidate category
        old_category = case.get('category', '')
        new_category = consolidate_category(old_category)
        if old_category != new_category:
            category_changes[old_category] = new_category
        case['category'] = new_category
        
        # Consolidate organ system
        old_organ = case.get('organ_system', '')
        new_organ = consolidate_organ_system(old_organ)
        if old_organ != new_organ:
            organ_changes[old_organ] = new_organ
        case['organ_system'] = new_organ
    
    # Write consolidated data
    print(f"Writing consolidated data to {output_path}...")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(cases, f, indent=2, ensure_ascii=False)
    
    # Print statistics
    final_categories = {}
    final_organs = {}
    
    for case in cases:
        cat = case.get('category', 'Unknown')
        org = case.get('organ_system', 'Unknown')
        
        final_categories[cat] = final_categories.get(cat, 0) + 1
        final_organs[org] = final_organs.get(org, 0) + 1
    
    print(f"\nConsolidation complete!")
    print(f"Final categories ({len(final_categories)}):")
    for cat, count in sorted(final_categories.items()):
        print(f"  {cat}: {count}")
    
    print(f"\nFinal organ systems ({len(final_organs)}):")
    for org, count in sorted(final_organs.items()):
        print(f"  {org}: {count}")
    
    print(f"\nCategory changes made: {len(category_changes)}")
    print(f"Organ system changes made: {len(organ_changes)}")

if __name__ == "__main__":
    main()
