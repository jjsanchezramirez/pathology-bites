#!/usr/bin/env python3
"""
Standardize organ systems in virtual slides data by mapping various names to standard organ system categories.
Remove entries that are disease names/diagnoses rather than organ systems.
"""

import json
import re
from pathlib import Path
from collections import Counter

def get_organ_system_mapping():
    """
    Return a comprehensive mapping of various organ system names to standardized names.
    """
    return {
        # Heart
        'Heart': ['Cardiac', 'Heart', 'Heart (atrium)', 'Heart (left atrium)', 'Left atrial tumor', 'Left and right atria', 'heart', 'atrium'],
        
        # Blood
        'Blood': ['Blood'],
        
        # Blood Vessels
        'Blood Vessels': ['Blood Vessels', 'Aortic arch', 'Azygos vein', 'Carotid bifurcation', 'Carotid mass', 'Carotid shea', 'area of bifurcation of the common carotid artery'],
        
        # Pericardium and Pleura
        'Pericardium and Pleura': ['Pericardium', 'Pleura', 'pleura'],
        
        # Lung
        'Lung': ['Lung', 'Lung & soft tisue (chest wall)', 'Lung (2 cases)', 'Lung (3 cases)', 'Lung (metastasis from a soft tissue tumor from the thigh)', 'Lung (pleura)', 'Lung [adrenal]', 'Lung pleura', 'Left lung', 'Left lung (surgery)', 'Lower lobe of right lung', 'lung', 'Bronchus'],
        
        # Larynx
        'Larynx': ['Larynx', 'Larynx - trachea', 'larynx'],
        
        # Esophagus
        'Esophagus': ['Esophagus'],
        
        # Stomach
        'Stomach': ['Stomach', 'Stomach mucosa', 'Stomach wall', 'stomach', 'stomach, peritoneum', 'Pylorus'],
        
        # Small Bowel
        'Small Bowel': ['Small bowel', 'Small bowel (duodenum)', 'Small bowel (ileum)', 'Small bowel (jejunum)', 'Small bowel - large bowel', 'Small bowel and mesentery', 'Small intestine', 'small intestine', 'Duodenum', 'Duodenum (autopsy)', 'Jejunum', 'Ileum', 'Large bowel (ileocecal valve)', 'Segment of ileum', 'Terminal ileum'],
        
        # Colon and Rectum
        'Colon and Rectum': ['Large bowel', 'Large bowel (cecum)', 'Large bowel (rectum)', 'Large bowel (sigmoid colon)', 'large bowel', 'Cecum', 'Colon', 'Large bowel (colon)', 'Sigmoid colon', 'Rectosigmoid', 'Rectum'],
        
        # Appendix
        'Appendix': ['Appendix'],
        
        # Anus
        'Anus': ['Anus', 'Anus, large bowel', 'anus'],
        
        # Liver
        'Liver': ['Liver', 'Liver (autopsy)', 'Liver (explanted)', 'Left lobe of liver', 'Right lobe of liver', 'Mass in liver', 'Post mortem liver', 'Cyst adherant to under surface of the liver', 'liver'],
        
        # Gallbladder
        'Gallbladder': ['Gallbladder', 'Gallbladder wall'],
        
        # Pancreas and Bile Ducts
        'Pancreas and Bile Ducts': ['Pancreas', 'Pancreas (autopsy)', 'Pancreatic cyst', 'Head of pancreas', 'Tail of pancreas', 'pancreatic islets', 'Bile duct carcinoma', 'Ductus choledochus', 'Right epatic duct'],
        
        # Ampulla
        'Ampulla': ['Ampulla of Vater', 'Papilla of vater'],
        
        # Kidney
        'Kidney': ['Kidney', 'Kidney (Uterus, corpus)', 'Kidney (pelvis)', 'Kidney - ureter', 'Kidney [uterus, corpus]', 'Kidney, Salivary glands', 'Kidneys', 'Left kidney', 'Left and right kidney', 'Right kidney', 'Right kidney and section of ureter', 'kidney'],
        
        # Bladder
        'Bladder': ['Bladder', 'Bladder - urethra', 'Bladder tumor', 'Mass attached to bladder', 'Urinary bladder', 'bladder'],
        
        # Ureter
        'Ureter': ['Ureter', 'Left ureter', 'Right ureter', 'ureter'],
        
        # Urethra
        'Urethra': ['Urethra', 'Urethral area'],
        
        # Prostate
        'Prostate': ['Prostate'],
        
        # Penis and Scrotum
        'Penis and Scrotum': ['Penis', 'Penis (scrotum)', 'Penis - scrotum', 'Penis [scrotum]', 'Growth on penis', 'Scrotal mass', 'Scrotum', 'Right scrotum', 'scrotum'],
        
        # Testis and Epididymis
        'Testis and Epididymis': ['Testicular mass', 'Testicular tumor', 'Testis', 'Testis (in a 11 month old)', 'Testis (paratesticular)', 'Testis (paratesticular region)', 'Left testicle', 'Left testis', 'Right testis', 'Tumor, undescended testes', 'testicle', 'testis', 'Epedidymis - spermatic cord', 'Epididymis'],
        
        # Ovary
        'Ovary': ['Ovarian tumor', 'Ovaries', 'Ovary', 'Ovary [adnexa]', 'Ovary [liver]', 'Ovary and left tube', 'Ovay (left)', 'Left ovary', 'Right ovary', 'ovary'],
        
        # Fallopian Tubes
        'Fallopian Tubes': ['Fallopian tube (adnexae)', 'Fallopian tubes'],
        
        # Uterus
        'Uterus': ['Uterine cavity', 'Uterus', 'Uterus (cervix)', 'Uterus (corpus)', 'Uterus, corpus', 'Uerus (corpus)', 'uterus', 'Corpus', 'corpus', 'Myometrium', 'Endometrial cavity'],
        
        # Cervix
        'Cervix': ['Cervix', 'cervix'],
        
        # Vagina and Vulva
        'Vagina and Vulva': ['Vagina', 'Vulva', 'Vula', "Region of the Bartholin's gland", 'Right labium majus'],
        
        # Thyroid
        'Thyroid': ['Thyroid', 'Thyroid and cervical lymph node', 'Thyroid gland', 'Isthmus of Thyroid', 'Left lobe of Thyroid', 'Right lobe of Thyroid', 'Right lobe of the Thyroid', 'Right lobe of thyroid', 'thyroid'],
        
        # Parathyroid
        'Parathyroid': ['Parathyroid', 'Parathyroid gland', 'parathyroid'],
        
        # Adrenal
        'Adrenal': ['Adrenal', 'Adrenal (elephantine)', 'Adrenal - peritoneum - soft tissues', 'Adrenal gland', 'Adrenal tumor', 'Bilateral adrenal tumor', 'Left adrenal', 'Left adrenal tumor', 'Right adrenal', 'Right adrenal tumor (surgery)', 'adrenal'],
        
        # Pituitary
        'Pituitary': ['Pituitary'],
        
        # Brain
        'Brain': ['Brain', 'Brain (CNS)', 'CNS', 'CNS (Brain)', 'CNS (brain)', 'CNS (IV ventricle)', 'CNS (cerebellum)', 'CNS (dura)', 'CNS (falx)', 'CNS (frontal fossa)', 'CNS - pineal', 'Central Nervous System', 'Cerebrum', 'Right cerebral hemisphere', 'Pineal recess', 'Third ventricle', 'The clivus surrounding the lower brainstem'],
        
        # Cerebrospinal Fluid
        'Cerebrospinal Fluid': ['Cerebrospinal Fluid'],
        
        # Peripheral nerves
        'Peripheral Nerves': ['Peripheral nerves', 'Left VIII and XII cranial nerves (autopsy)'],
        
        # Eye
        'Eye': ['Eye', 'Eye (Breast)', 'Eye (Eyelid)', 'Eye, eyelid', 'Eye, lacrimal gland', 'Left eyeball', 'Right eyeball', 'Contents of right orbit inbcluding the eyeball and eyelids', 'Optic nerve', 'Conjunctiva', 'Cornea', 'Lens', 'Retina', 'Uvea', 'Vitreous', 'Orbit', 'Orbit and lacrimal gland', 'Right orbit', 'Lacrimal gland', 'Caruncle'],
        
        # Ear
        'Ear': ['Ear'],
        
        # Nasal cavity
        'Nasal Cavity': ['Nasal cavity', 'Nasal cavity - eye', 'Nasal cavity - nasopharynx', 'NaSAL CAVITY', 'Left nasal cavity', 'nasal cavity', 'nasal antrum', 'nasal fossa', 'nasal septum'],
        
        # Nasopharynx
        'Nasopharynx': ['Nasopharyngeal lesion', 'Nasopharynx', 'nasopharynx'],
        
        # Nose and Sinuses
        'Nose and Sinuses': ['Nose', 'nose', 'Right maxillary sinus', 'Sinus'],
        
        # Oral Cavity
        'Oral Cavity': ['Oral Cavity', 'Oral cavity', 'Oral cavity (palate)', 'Oral cavity (parapharyngeal region)', 'Oral cavity (pyriform sinus)', 'Oral cavity (tonsil)'],
        
        # Palate
        'Palate': ['Palate', 'Anterior hard palate', 'Left soft palate and left tonsillar fossa', 'hard palate'],
        
        # Tongue
        'Tongue': ['Tongue', 'Base of tongue'],
        
        # Tonsil
        'Tonsil': ['Tonsil', 'tonsil'],
        
        # Mandible
        'Mandible': ['Mandible and maxilla', 'Mandible and maxilla - oral cavity', 'Right side of mandible'],
        
        # Maxilla
        'Maxilla': ['Maxillary sinus', 'Right maxilla', 'maxillary antrum'],
        
        # Pharynx
        'Pharynx': ['Pharynx', 'Left lateral pharyngeal wall', 'Retropharingeal mass, right side'],
        
        # Salivary Glands
        'Salivary Glands': ['Salivary', 'Salivary Gland', 'Salivary gland', 'Salivary gland (parotid)', 'Salivary gland (submandibular)', 'Salivary glands', 'SaLIVARY GLAND (PAROTID)', 'Fight submaxillary salivary gland', 'Left submandibular gland', 'salivary gland (parotid)', 'Parotid', 'Parotid gland', 'Left parotid', 'Left parotid gland', 'Right parotid gland', 'parotid', 'parotis'],

        # Bone
        'Bone': ['Bone', 'Bone (T7)', 'Bone (big toe)', 'Bone (chest wall)', 'Bone (femur)', 'Bone (foot)', 'Bone (leg)', 'Bone (mandible)', 'Bone (maxilla)', 'Bone (rib)', 'Bone (scapula)', 'Bone (shoulder)', 'Bone (temporal)', 'Bone and Soft Tissue', 'Bone, CNS', 'Bone, astragalus', 'Bone, clavicle', 'Bone, femoral head', 'Bone, femur', 'Bone, fibula', 'Bone, finger', 'Bone, foot', 'Bone, gluteus', 'Bone, humerus', 'Bone, iliac', 'Bone, ilium', 'Bone, joint', 'Bone, mandible', 'Bone, maxilla', 'Bone, os calcis', 'Bone, pubis', 'Bone, radius', 'Bone, rib', 'Bone, sacrococcygeal region', 'Bone, sacrum', 'Bone, scapula', 'Bone, skull', 'Bone, sternum', 'Bone, tibia', 'Bone, ulna', 'Bone, vertebra', 'Bone. tibia', 'Bones (distal radius)', 'bone', 'bone ??', 'bone soft tissues', 'Rib', 'Tibia', 'Right pubic ramus', 'Lumbosacral vertebrae', 'scapula', 'Skull', 'Right skull'],

        # Muscle
        'Muscle': ['Skeletal muscle', 'Muscle', 'proximal rtight forearm', 'Rectus femoris muscle', 'sternocleidomastoid muscle'],

        # Bone marrow
        'Bone Marrow': ['Bone marrow'],

        # Lymph nodes
        'Lymph Nodes': ['Lymph Nodes', 'Lymph node', 'Lymph node from left axilla', 'Lymph node (axillary)', 'Lymph node (inguinal)', 'Lymph node (parotid region)', 'Lymph node (supraclavicular)', 'Lymph node, axillary', 'Lymph node, cervical', 'Lymph node, neck (thyroid)', 'Lymph node, neck and axilla', 'Lymph node, retroperitoneal', 'Lymphnodes', 'Cervical Node', 'Cervical lymph node', 'Cervical node', 'Infraclavicular node', 'Inguinal lymph node', 'Inguinal node', 'Left axillary lymph node', 'Left axillary and cervical lymph node', 'Left inguinal lymph node', 'Left posterior cervical chain', 'Right axillary lymph node', 'Right cervical lymph node', 'Right femoral area lymph node', 'Mesenteric lymph nodes', 'Pelvic lymph node', 'abdominal lymph node', 'axillary lymph node', 'lymph node', 'lymph node cervical', 'lymph node inguinal', 'lymph nodes', 'lymph nodes mediatinum', 'retroperitoneal lymph nodes', 'supraclavicular lymph node'],

        # Spleen
        'Spleen': ['Spleen', 'Spleen (kidney)', 'Spleen and liver', 'spleen'],

        # Thymus
        'Thymus': ['Thymus', 'thymus'],

        # Skin
        'Skin': ['Skin', 'Skin & soft tissue (chest wall)', 'Skin & soft tissue groin', 'Skin (arm)', 'Skin (breast)', 'Skin (forehead)', 'Skin (hip)', 'Skin (neck)', 'Skin (scalp)', 'Skin (shoulder)', 'Skin and oral cavity', 'Skin from anterior chest', 'Skin nodules', 'Skin of back', 'Skin of foot (leonine)', 'Skin of forehead and right parotid gland', 'Skin of nose', 'Skin of sacral area', 'Skin arm', 'Skin chest wall', 'Skin ear', 'Skin eye', 'Skin eye (eyebrow)', 'Skin eyebrow & eyelid', 'Skin face', 'Skin flank', 'Skin foot', 'Skin foot dorsum', 'Skin forearm', 'Skin groin area', 'Skin hip', 'Skin left thigh', 'Skin leg', 'Skin leg (ankle)', 'Skin nape of neck', 'Skin neck (lung)', 'Skin posterior left ear', 'Skin pretibial region', 'Skin scalp', 'Skin thigh', 'Pigmented lesion of skin right knee', 'Pigmented lesion on breast', 'Mole on back', 'Lesions on back and neck', 'skin', 'skin (scalp)', 'skin soft tissues', 'skin scalp', 'from skin of scalp', 'Eyelid', 'Lip'],

        # Mediastinum
        'Mediastinum': ['Mediastinal mass', 'Mediastinum', 'Mediastinum (Thymus)', 'Mediastinum (thymus)', 'Mediastinum - soft tissues - retroperitoneum', 'Mediastinum-soft tissues-peritoneum', 'Mediastinum-thymus', 'Medistinum', 'Anterior mediastinal mass', 'Anterior mediastinum', 'Right neck and right superior mediastinum', 'anterior mediastinum', 'mediastinum'],

        # Peritoneum and Retroperitoneum
        'Peritoneum and Retroperitoneum': ['Peritoneal Washings', 'Peritoneum', 'Peritoneum (Adrenal)', 'Peritoneum (Retroperitoneum)', 'Peritoneum (adrenal)', 'Peritoneum (appendix)', 'Peritoneum (bowel mesentery)', 'Peritoneum (ligament of Treitz)', 'Peritoneum (mesentery)', 'Peritoneum (obturator region)', 'Peritoneum (omentum)', 'Peritoneum (pelvic wall)', 'Peritoneum (pelvis)', 'Peritoneum (rectovaginal septum)', 'Peritoneum (retroperitoenum)', 'Peritoneum (retroperitoneum)', 'Peritoneum (retroperitoneum adrenal)', 'Peritoneum (sacroccygeal region)', 'Peritoneum (sacrococcygeal region)', 'Peritoneum (uterus)', 'Peritoneum - retroperitoneum', 'Peritoneum - sacrococcygeal region', 'Peritoneum bowel', 'Peritoneum corpus large bowel', 'Peritoneum large bowel', 'Diffuse peritoneal tumor', 'Pelvic peritoneum', 'peritoneum', 'Retroperitoneal mass', 'Retroperitoneal pelvic mass', 'Retroperitoneal tumor', 'Retroperitoneum', 'Retroperitoneum/ kidney', 'Right retroperitoneum', 'retroperitoneal', 'retroperitoneum', 'Omentum'],

        # Soft Tissues - comprehensive list of anatomic locations
        'Soft Tissues': ['Soft tissue', 'Soft tissues', 'soft tissue', 'soft tissues', 'Soft tissue (abdomen)', 'Soft tissue (arm)', 'Soft tissue (back)', 'Soft tissue (buttock)', 'Soft tissue (chest)', 'Soft tissue (chest wall)', 'Soft tissue (elbow)', 'Soft tissue (face)', 'Soft tissue (finger)', 'Soft tissue (foot)', 'Soft tissue (forearm)', 'Soft tissue (groin)', 'Soft tissue (hand)', 'Soft tissue (hip)', 'Soft tissue (knee)', 'Soft tissue (leg)', 'Soft tissue (neck)', 'Soft tissue (pelvis)', 'Soft tissue (scalp)', 'Soft tissue (shoulder)', 'Soft tissue (thigh)', 'Soft tissue (toe)', 'Soft tissue (wrist)', 'Soft tissue - bone', 'Soft tissue - skin', 'Soft tissue and bone', 'Soft tissue mass', 'Soft tissue tumor', 'Soft tissue, abdomen', 'Soft tissue, arm', 'Soft tissue, back', 'Soft tissue, buttock', 'Soft tissue, chest', 'Soft tissue, chest wall', 'Soft tissue, elbow', 'Soft tissue, face', 'Soft tissue, finger', 'Soft tissue, foot', 'Soft tissue, forearm', 'Soft tissue, groin', 'Soft tissue, hand', 'Soft tissue, hip', 'Soft tissue, knee', 'Soft tissue, leg', 'Soft tissue, neck', 'Soft tissue, pelvis', 'Soft tissue, scalp', 'Soft tissue, shoulder', 'Soft tissue, thigh', 'Soft tissue, toe', 'Soft tissue, wrist', 'Abdominal wall', 'Chest wall', 'Pelvic wall', 'Neck mass', 'Neck soft tissue', 'Axilla', 'Groin', 'Inguinal region', 'Subcutaneous tissue', 'Fascia', 'Connective tissue', 'Fibrous tissue']
    }

def get_disease_patterns():
    """
    Return patterns that identify disease names/diagnoses rather than organ systems.
    These should be removed from the data.
    """
    disease_patterns = [
        # Tumor types and specific diagnoses
        r'.*sarcoma.*', r'.*carcinoma.*', r'.*adenoma.*', r'.*lymphoma.*', r'.*leukemia.*',
        r'.*tumor.*', r'.*neoplasm.*', r'.*cancer.*', r'.*malignancy.*',
        # Specific disease names
        r'".*"', r"'.*'", r'.*oma$', r'.*osis$', r'.*itis$',
        # Question marks and uncertainty indicators
        r'\?.*', r'.*\?.*', r'unknown', r'unclear', r'unspecified',
        # Percentages and numbers that are clearly not organs
        r'\d+%', r'^\d+$',
        # Specific pathological terms
        r'.*blastoma.*', r'.*fibroma.*', r'.*lipoma.*', r'.*myoma.*',
        r'.*hyperplasia.*', r'.*dysplasia.*', r'.*metastasis.*', r'.*invasion.*'
    ]
    return disease_patterns

def is_disease_name(subcategory):
    """
    Check if a subcategory is likely a disease name rather than an organ system.
    """
    if not subcategory or subcategory.strip() == '':
        return True

    subcategory_lower = subcategory.lower().strip()

    # Specific disease terms to remove
    disease_terms = [
        'sarcoma', 'carcinoma', 'adenoma', 'lymphoma', 'leukemia', 'tumor', 'neoplasm',
        'cancer', 'malignancy', 'blastoma', 'fibroma', 'lipoma', 'myoma', 'hyperplasia',
        'dysplasia', 'metastasis', 'invasion', 'grade', 'type', 'variant', 'cell',
        'differentiated', 'undifferentiated', 'benign', 'malignant', 'primary', 'secondary',
        'recurrent', 'metastatic', 'invasive', 'in situ', 'spindle', 'giant', 'clear',
        'squamous', 'adenoid', 'cystic', 'solid', 'papillary', 'follicular', 'medullary',
        'anaplastic', 'pleomorphic', 'epithelioid', 'myxoid', 'sclerosing', 'desmoplastic',
        'inflammatory', 'granular', 'oncocytic', 'chromophobe', 'collecting', 'transitional'
    ]

    # Check if it contains disease terms
    for term in disease_terms:
        if term in subcategory_lower:
            return True

    # Check against disease patterns
    disease_patterns = get_disease_patterns()
    for pattern in disease_patterns:
        if re.match(pattern, subcategory_lower):
            return True

    # Check for specific patterns that indicate diseases
    if any([
        subcategory_lower.startswith('grade '),
        subcategory_lower.startswith('type '),
        subcategory_lower.endswith(' grade'),
        subcategory_lower.endswith(' type'),
        subcategory_lower.endswith(' variant'),
        subcategory_lower.endswith(' cell'),
        subcategory_lower.endswith(' cells'),
        'vs.' in subcategory_lower,
        'vs ' in subcategory_lower,
        ' vs' in subcategory_lower,
        'with ' in subcategory_lower and len(subcategory_lower) > 20,
        subcategory_lower.startswith('probably '),
        subcategory_lower.startswith('possibly '),
        subcategory_lower.startswith('likely '),
        re.search(r'\b(positive|negative|stain|marker|antibody)\b', subcategory_lower),
        re.search(r'\b(classification|staging|grading)\b', subcategory_lower),
    ]):
        return True

    return False

def standardize_organ_systems(input_file, output_file):
    """
    Standardize organ systems in the virtual slides data.
    """
    # Load the data
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print(f"Original dataset: {len(data)} cases")
    
    # Get the organ system mapping
    organ_mapping = get_organ_system_mapping()
    
    # Create reverse mapping for quick lookup
    reverse_mapping = {}
    for standard_name, variants in organ_mapping.items():
        for variant in variants:
            reverse_mapping[variant.lower().strip()] = standard_name
    
    # Process the data
    standardized_data = []
    removed_count = 0
    mapping_stats = Counter()
    
    for case in data:
        original_subcategory = case.get('subcategory', '').strip()
        
        # Skip if it's a disease name
        if is_disease_name(original_subcategory):
            removed_count += 1
            continue
        
        # Try to map to standard organ system
        subcategory_lower = original_subcategory.lower().strip()
        mapped = False

        # First try exact match
        if subcategory_lower in reverse_mapping:
            case['subcategory'] = reverse_mapping[subcategory_lower]
            mapping_stats[reverse_mapping[subcategory_lower]] += 1
            mapped = True
        else:
            # Try partial matches for complex entries
            for variant, standard_name in reverse_mapping.items():
                # Check if the subcategory starts with a known organ system
                if subcategory_lower.startswith(variant + ' ') or subcategory_lower.startswith(variant + ' ('):
                    case['subcategory'] = standard_name
                    mapping_stats[standard_name] += 1
                    mapped = True
                    break
                # Check if a known organ system is contained within parentheses
                elif f'({variant})' in subcategory_lower or f'[{variant}]' in subcategory_lower:
                    case['subcategory'] = standard_name
                    mapping_stats[standard_name] += 1
                    mapped = True
                    break

        if not mapped:
            # Keep original if no mapping found and it's not a disease
            if original_subcategory:  # Only keep non-empty
                mapping_stats[original_subcategory] += 1
        
        standardized_data.append(case)
    
    # Save the standardized data
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(standardized_data, f, indent=2, ensure_ascii=False)
    
    print(f"Standardized dataset: {len(standardized_data)} cases")
    print(f"Removed {removed_count} cases with disease names/diagnoses")
    
    # Print statistics
    print(f"\nTop 20 standardized organ systems:")
    print("-" * 50)
    for organ_system, count in mapping_stats.most_common(20):
        print(f"{organ_system}: {count}")
    
    return len(standardized_data), removed_count

def main():
    """Main function to standardize organ systems."""
    base_path = Path(__file__).parent.parent
    input_file = base_path / 'virtual-slides-filtered.json'
    output_file = base_path / 'virtual-slides-standardized.json'
    
    if not input_file.exists():
        print(f"Error: Input file not found: {input_file}")
        return
    
    print("Standardizing organ systems in virtual slides data...")
    print("=" * 60)
    
    kept_count, removed_count = standardize_organ_systems(input_file, output_file)
    
    print("=" * 60)
    print("Standardization complete!")
    print(f"✅ Kept: {kept_count:,} cases with valid organ systems")
    print(f"❌ Removed: {removed_count:,} cases with disease names/diagnoses")
    print(f"📁 Output saved to: {output_file}")

if __name__ == "__main__":
    main()
