#!/usr/bin/env python3
"""
Consolidate virtual slide categories and organ systems according to the specified mapping.
"""

import json
from pathlib import Path
from collections import Counter

def get_category_mapping():
    """Define the category consolidation mapping."""
    return {
        # Breast Pathology (4,375 cases)
        "Breast Pathology": [
            "Breast"
        ],

        # Dermatopathology (4,724+ cases)
        "Dermatopathology": [
            "Derm",
            "Cutaneous Lymphomas And Leukemias",
            "Cutaneous Toxicities Of Drugs",
            "Benign Pigmented Lesions",
            "Malignant Melanoma",
            "Metabolic Diseases Of The Skin",
            "Metastatic Carcinoma Of The Skin",
            "Mimicry In Melanocytic Lesions",
            "Normal Skin",
            "Pediatric Dermatopathology",
            "Panniculitis",
            "Photosentivity And Physical Agents",
            "Tumors And Cysts Of The Epidermis",
            "Tumors Of The Epidermal Appendages",
            "Vesiculobullous And Vesiculopustular Diseases",
            "Erythematous, Papular And Squamous Diseases",
            "Degerative, Perforating And Nutritional Diseases",
            "Non-Infectious And Palisading Granulomas",
            "Inflammatory Dz Of Epid Appendages And Cartilage"
        ],

        # Gastrointestinal Pathology (1,400+ cases)
        "Gastrointestinal Pathology": [
            "GI",
            "Gi-Tract",
            "Gastrointestinal Tract"
        ],

        # Genitourinary Pathology (1,081+ cases)
        "Genitourinary Pathology": [
            "GU",
            "Uropathology",
            "Lower Urinary Tract And Male Genital System",
            "Kidney And Adrenal Gland",
            "Renal Pelvis And Ureter",
            "Urethra",
            "Urine And Bladder Washings",
            "Penis",
            "Scrotum",
            "Testis"
        ],

        # Gynecologic Pathology (901+ cases)
        "Gynecologic Pathology": [
            "Gyn",
            "Female Genital Tract",
            "Cervical And Vaginal Cytology",
            "Ovary - Germ Cell Tumors - Mixed",
            "Ovary - Germ Cell Tumors - Monodermal Teratomas",
            "Ovary - Germ Cell Tumors - Primitive",
            "Ovary - Germ Cell Tumors - Teratoma With Somatic Type Tumor",
            "Ovary - Germ Cell Tumors - Teratomas",
            "Obstetrics",
            "Trophoblastic Pathology",
            "Fetal Vascular Malperfusion",
            "Maternal Vascular Malperfusion",
            "Miscellaneous Placental Pathology",
            "Placental Infections",
            "Placental Pathologies With Recurrence Risk",
            "Peritoneal Washings"
        ],

        # Head and Neck Pathology (1,123+ cases)
        "Head and Neck Pathology": [
            "Head and Neck",
            "Headneck",
            "Neck",
            "Oral Cavity",
            "Oral Pathology",
            "Larynx",
            "Larynx, Trachea, Hypopharynx",
            "Sinonasal And Nasopharynx",
            "Sinus",
            "Parotid",
            "Salivary Gland",
            "Salivarygland",
            "Salivary - Acinic Cell Carcinoma",
            "Salivary - Adenoid Cystic",
            "Salivary - Basal Cell Carcinoma",
            "Salivary - Intraductal Carcinoma",
            "Salivary - Lymphoepithelial Carcinoma",
            "Salivary - Mec",
            "Salivary - Miscellaneous",
            "Salivary - Mucoepidermoid",
            "Salivary - Oncocytoma",
            "Salivary - Pleomorphic Adenoma",
            "Salivary - Polymorphous Adenocarcinoma",
            "Salivary - Secretory Carcinoma",
            "Salivary - Squamous Cell Carcinoma",
            "Ear",
            "Ear And Temporal Bone"
        ],

        # Hematopathology (1,340+ cases)
        "Hematopathology": [
            "Hemepath",
            "White Blood Cells, Lymph Nodes, Spleen, And Thymus",
            "Lymph Nodes",
            "Hematopoietic Tumors",
            "Red Blood Cells And Bleeding Disorders",
            "Histiocytoses"
        ],

        # Hepatobiliary and Pancreatic Pathology (693+ cases)
        "Hepatobiliary and Pancreatic Pathology": [
            "Liver/Pancreatobiliary",
            "Liver And Biliary Tract",
            "Hepatobiliary and Pancreas",
            "Pancreas And Biliary Tree",
            "Pancreatobiliary"
        ],

        # Bone and Soft Tissue Pathology (1,075+ cases)
        "Bone and Soft Tissue Pathology": [
            "Bone and Soft Tissue",
            "Bones, Joints, And Soft-Tissue Tumours",
            "Soft Tissues",
            "Softtissue",
            "Benign Bone-Forming Tumors",
            "Benign Cartilage Tumors",
            "Malignant Bone-Forming Tumors",
            "Malignant Cartilage Tumors",
            "Cystic Lesions Of Bone",
            "Giant Cell-Rich Tumors",
            "Notochordal Tumors",
            "Fibrous And Fibrohistiocytic Tumors",
            "Miscellaneous Mesenchymal Tumors",
            "Tumors Of Fatty, Osseous And Muscular Tissue",
            "Tumors Of Fibrous Tissue",
            "Peripheral Nerve And Skeletal Muscle"
        ],

        # Neuropathology (830+ cases)
        "Neuropathology": [
            "Neuro",
            "Central Nervous System",
            "Cerebrospinal Fluid",
            "Tumors Of Neural Tissue"
        ],

        # Pulmonary Pathology (642+ cases)
        "Pulmonary Pathology": [
            "Respiratory Tract",
            "Respiratory Tract And Mediastinum",
            "Pulmonary Pathology",
            "Pulmonary/Thoracic",
            "Lungs",
            "Pleural, Pericardial, And Peritoneal Fluids"
        ],

        # Endocrine Pathology (577+ cases)
        "Endocrine Pathology": [
            "Endocrine",
            "Endocrine System"
        ],

        # Ophthalmic Pathology (256+ cases)
        "Ophthalmic Pathology": [
            "Ophthalmic",
            "Conjunctiva",
            "Cornea",
            "Eyelid",
            "Lens",
            "Optic Nerve",
            "Orbit",
            "Orbit And Lacrimal Gland",
            "Retina",
            "Uvea",
            "Vitreous"
        ],

        # Pediatric Pathology (296+ cases)
        "Pediatric Pathology": [
            "Peds",
            "Paidopathology"
        ],

        # Cytopathology (215+ cases)
        "Cytopathology": [
            "Cyto",
            "Pip"
        ],

        # Cardiovascular Pathology (95+ cases)
        "Cardiovascular Pathology": [
            "Cardiovascular"
        ],

        # General/Miscellaneous (1,402+ cases)
        "General/Miscellaneous": [
            "General",
            "Others",
            "Potpourri",
            "Miscellaneous",
            "Publications",
            "Tumors",
            "Metastatic Tumors",
            "Malignant Small Round Cell Tumors",
            "Acute Insults",
            "Bacterial, Mycobacterial, And Treponemal Diseases",
            "Congenital Diseases",
            "Connective Tissue Diseases",
            "Fungal, Protozoal And Parasitic Diseases",
            "Infective Diseases",
            "Vascular Diseases",
            "Vascular Tumors",
            "Viral Diseases"
        ]
    }

def get_organ_system_mapping():
    """Define the organ system consolidation mapping."""
    return {
        # Breast (4,309+ cases)
        "Breast": [
            "breast", "breast (male", "breast (canine", "hreast"
        ],

        # Skin (490+ cases)
        "Skin": [
            "skin", "skin (arm", "skin (breast", "skin (forehead", "skin (hip",
            "skin (neck", "skin (scalp", "skin (shoulder", "skin and oral cavity",
            "skin from anterior chest", "skin nodules", "skin of back", "skin of foot (leonine",
            "skin of forehead and right parotid gland", "skin of leg (equine", "skin of neck",
            "skin of neck (canine", "skin of nose", "skin of sacral area", "skin of upper neck",
            "skin soft tissues", "skin, arm", "skin, chest wall", "skin, dorsum of left foot",
            "skin, ear", "skin, eye", "skin, eye (eyebrow", "skin, eyebrow & eyelid",
            "skin, face", "skin, flank", "skin, foot", "skin, foot dorsum", "skin, forearm",
            "skin, groin area", "skin, hip", "skin, left thigh", "skin, leg", "skin, leg (ankle",
            "skin, nape of neck", "skin, neck (lung", "skin, posterior left ear", "skin, pretibial region",
            "skin, right cheek", "skin, right chest wall", "skin, scalp", "skin, thigh"
        ],

        # Soft Tissue (200+ cases)
        "Soft Tissue": [
            "soft tissues", "soft tissue", "soft tissue (abdominal wall", "soft tissue (arm",
            "soft tissue (back", "soft tissue (buttock", "soft tissue (calf", "soft tissue (chest wall",
            "soft tissue (foot", "soft tissue (forearm", "soft tissue (gluteal/ hip", "soft tissue (groin",
            "soft tissue (hand", "soft tissue (heel", "soft tissue (infrascapular", "soft tissue (leg",
            "soft tissue (neck", "soft tissue (perineum", "soft tissue (shoulder", "soft tissue (suprapubic region",
            "soft tissue (thigh", "soft tissue (upper back", "soft tissue (wrist", "soft tissue, abdomen",
            "soft tissue, abdominal wall (bladder", "soft tissue, ankle", "soft tissue, axilla",
            "soft tissue, back", "soft tissue, big toe", "soft tissue, buttock", "soft tissue, calf",
            "soft tissue, cheek", "soft tissue, chest wall", "soft tissue, face", "soft tissue, finger",
            "soft tissue, foot", "soft tissue, hand", "soft tissue, hip", "soft tissue, inguinal region",
            "soft tissue, joint (knee", "soft tissue, knee", "soft tissue, mediastinum", "soft tissue, neck",
            "soft tissue, oral cavity", "soft tissue, orbit (eye", "soft tissue, peritoneum (cul-de-sac",
            "soft tissue, retroperitoneum", "soft tissue, scalp (cns", "soft tissue, shoulder",
            "soft tissue, submandibular region", "soft tissue, thigh", "soft tissue, thigh (around knee",
            "soft tissue, wrist", "soft tissues (back", "soft tissues (forearm", "soft tissues (gluteal region",
            "soft tissues (mediastinum", "soft tissues (neck", "soft tissues (popliteal fossa",
            "soft tissues (skeletal muscle biopsy", "soft tissues lymph nodes thyroid",
            "soft tissues, abdominal cavity", "soft tissues, chest wall", "soft tissues, leg",
            "soft tissues, muscle biopsy (quadriceps", "softr tissue (gluteal, perirectal space",
            "softtissue", "subcutaneous tissue of the left knee"
        ],

        # Stomach (78+ cases)
        "Stomach": [
            "stomach", "stomach mucosa", "stomach wall", "stomach, peritoneum"
        ],

        # Colon and Rectum (60+ cases)
        "Colon and Rectum": [
            "large bowel", "large bowel (cecum", "large bowel (colon", "large bowel (ileocecal valve",
            "large bowel (rectum", "large bowel (sigmoid colon", "colon", "rectum", "rectum :",
            "sigmoid colon", "rectosigmoid", "anus, large bowel", "cecum", "peritoneum, large bowel",
            "peritoneum, corpus, large bowel"
        ],

        # Small Bowel (70+ cases)
        "Small Bowel": [
            "small bowel", "small bowel :", "small bowel (duodenum", "small bowel (ileum",
            "small bowel (jejunum", "small bowel - large bowel", "small bowel and mesentery",
            "duodenum", "duodenum (autopsy", "jejunum", "ileum", "terminal ileum",
            "segment of ileum", "small intestine", "intestine", "small bowel, large bowel"
        ],

        # Major organ systems - continuing with key ones
        "Esophagus": ["esophagus"],
        "Appendix": ["appendix"],
        "Anus": ["anus"],

        "Liver": ["liver", "liver (autopsy", "liver (explanted", "liver cell carcinoma; hepatoma", "post mortem liver"],
        "Pancreas": ["pancreas", "pancreas (autopsy", "pancreatic cyst", "pancreatic islets", "head of pancreas", "tail of pancreas"],
        "Gallbladder and Bile Ducts": ["gallbladder", "gallbladder wall", "bile duct carcinoma", "ductus choledochus"],

        "Kidney": ["kidney", "kidney (canine", "kidney (feline", "kidney (pelvis", "kidney (uterus, corpus", "kidney - ureter", "kidney [uterus, corpus]", "kidney, salivary glands", "kidneys"],
        "Bladder, Ureter, and Urethra": ["bladder", "bladder - urethra", "bladder tumor", "urinary bladder", "ureter", "urethra", "urethral area"],
        "Prostate": ["prostate"],
        "Testis": ["testis", "testis (in a 11 month old", "testis (paratesticular", "testis (paratesticular region", "testicular mass", "testicular tumor", "testicle"],
        "Penis": ["penis", "penis (scrotum", "penis - scrotum", "penis [scrotum]", "growth on penis"],
        "Scrotum": ["scrotum", "scrotum (canine", "scrotal mass"],

        "Ovary": ["ovaries", "ovarian tumor", "ovary [adnexa]", "ovary [liver]", "ovary and left tube", "ovay (left"],
        "Uterus": ["uterus", "uterus (cervix", "uterus (corpus", "uterus, corpus", "uterine cavity", "endometrial cavity", "uerus (corpus"],
        "Cervix": ["cervix"],
        "Vagina": ["vagina"],
        "Vulva": ["vulva", "vula"],

        "Thyroid": ["thyroid", "thyroid gland", "thyroid, right and left lobes", "isthmus of thyroid"],
        "Adrenal": ["adrenal", "adrenal (elephantine", "adrenal - peritoneum - soft tissues", "adrenal gland", "adrenal tumor"],
        "Parathyroid": ["parathyroid", "parathyroid :", "parathyroid gland"],
        "Pituitary": ["pituitary"],

        "Lungs": ["lungs", "lung (2 cases", "lung (3 cases", "lung (metastasis from a soft tissue tumor from the thigh", "lung (pleura", "lung [adrenal]", "lung pleura", "lung vs adrenal cortical", "lower lobe of right lung", "lower lobe of the left lung"],
        "Pleura and Mediastinum": ["pleura", "mediastinum", "mediastinum :", "mediastinum (thymus", "mediastinum - soft tissues - retroperitoneum", "mediastinum-soft tissues-peritoneum", "mediastinum-thymus", "medistinum"],

        "Bone": ["bone", "bone (big toe", "bone (chest wall", "bone (femur", "bone (foot", "bone (leg", "bone (mandible", "bone (maxilla", "bone (rib", "bone (scapula", "bone (shoulder", "bone (t7", "bone (temporal", "bone ?", "bone and soft tissue", "bone marrow", "bone soft tissues", "bone, astragalus", "bone, clavicle", "bone, cns :", "bone, femoral head", "bone, femur", "bone, fibula", "bone, finger", "bone, foot", "bone, gluteus", "bone, humerus", "bone, iliac", "bone, ilium", "bone, joint", "bone, mandible", "bone, maxilla", "bone, os calcis", "bone, pubis", "bone, radius", "bone, rib", "bone, sacrococcygeal region", "bone, sacrum", "bone, scapula", "bone, skull", "bone, sternum", "bone, tibia", "bone, ulna", "bone, vertebra", "bone. tibia", "bones (distal radius"],

        "Lymph Nodes": ["lymph nodes", "lymphnodes", "lymph node", "lymph node (axillary", "lymph node (inguinal", "lymph node (parotid region", "lymph node (supraclavicular", "lymph node, axillary", "lymph node, cervical", "lymph node, inguinal", "lymph node, neck (thyroid", "lymph node, neck and axilla", "lymph node, retroperitoneal", "lymph nodes mediatinum"],
        "Spleen": ["spleen", "spleen (kidney", "spleen and liver"],
        "Bone Marrow": ["bone marrow"],
        "Blood": ["blood"],

        # General/Misc for everything else
        "General/Misc": ["unknown", "others", "general"]
    }

def main():
    """Consolidate categories and organ systems in the unified virtual slides data."""
    script_dir = Path(__file__).parent
    unified_file = script_dir.parent / 'virtual-slides-unified.json'

    if not unified_file.exists():
        print(f"Error: {unified_file} not found")
        return

    print("Loading unified virtual slides data...")
    with open(unified_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Get mappings
    category_mapping = get_category_mapping()
    organ_system_mapping = get_organ_system_mapping()

    # Create reverse mappings for quick lookup
    category_reverse_mapping = {}
    for new_category, old_categories in category_mapping.items():
        for old_category in old_categories:
            category_reverse_mapping[old_category] = new_category

    organ_system_reverse_mapping = {}
    for new_organ_system, old_organ_systems in organ_system_mapping.items():
        for old_organ_system in old_organ_systems:
            organ_system_reverse_mapping[old_organ_system] = new_organ_system

    # Track consolidation statistics
    category_stats = Counter()
    organ_system_stats = Counter()
    original_categories = Counter()
    original_organ_systems = Counter()

    # Update categories and organ systems in the data
    for case in data:
        # Process categories
        original_category = case.get('category', '')
        original_categories[original_category] += 1

        if original_category in category_reverse_mapping:
            new_category = category_reverse_mapping[original_category]
            case['category'] = new_category
            category_stats[new_category] += 1
        else:
            category_stats[original_category] += 1

        # Process organ systems
        original_organ_system = case.get('organ_system', '')
        original_organ_systems[original_organ_system] += 1

        if original_organ_system in organ_system_reverse_mapping:
            new_organ_system = organ_system_reverse_mapping[original_organ_system]
            case['organ_system'] = new_organ_system
            organ_system_stats[new_organ_system] += 1
        else:
            organ_system_stats[original_organ_system] += 1

    # Save updated data
    output_file = script_dir.parent / 'virtual-slides-unified-consolidated.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"\nConsolidated data saved to: {output_file}")
    print(f"Total cases: {len(data)}")

    # Print consolidation results
    print("\nCONSOLIDATED CATEGORIES:")
    print("=" * 50)
    for category, count in category_stats.most_common():
        print(f"{category}: {count} cases")

    print("\nCONSOLIDATED ORGAN SYSTEMS:")
    print("=" * 50)
    for organ_system, count in organ_system_stats.most_common():
        print(f"{organ_system}: {count} cases")

if __name__ == "__main__":
    main()
