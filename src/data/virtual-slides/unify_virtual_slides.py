#!/usr/bin/env python3
"""
Script to consolidate virtual slide data from multiple sources into a unified format.
Focuses on extracting diagnosis, clinical info, category, and organ system.
"""

import json
import re
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple

class VirtualSlidesConsolidator:
    """Consolidates virtual slide data from multiple pathology sources."""
    
    def __init__(self):
        self.category_mapping = {
            # Normalize variations to standard categories
            'breast': 'Breast',
            'breast pathology': 'Breast',

            # Bone and Soft Tissue
            'bone': 'Bone and Soft Tissue',
            'bone and soft tissue': 'Bone and Soft Tissue',
            'soft tissue': 'Bone and Soft Tissue',
            'bones, joints, and soft-tissue tumours': 'Bone and Soft Tissue',
            'soft tissues': 'Bone and Soft Tissue',

            # Cardiovascular
            'cardiovascular': 'Cardiovascular',
            'blood vessels': 'Cardiovascular',
            'heart': 'Cardiovascular',

            # Gastrointestinal
            'gastrointestinal': 'Gastrointestinal',
            'gastrointestinal tract': 'Gastrointestinal',
            'gi': 'Gastrointestinal',
            'liver': 'Gastrointestinal',
            'liver and biliary tract': 'Gastrointestinal',
            'pancreas': 'Gastrointestinal',
            'pancreas and biliary tree': 'Gastrointestinal',
            'pancreatobiliary': 'Gastrointestinal',

            # Genitourinary
            'genitourinary': 'Genitourinary',
            'uropathology': 'Genitourinary',
            'gu': 'Genitourinary',
            'kidney': 'Genitourinary',
            'bladder': 'Genitourinary',
            'prostate': 'Genitourinary',
            'testis': 'Genitourinary',
            'lower urinary tract and male genital system': 'Genitourinary',
            'renal pelvis and ureter': 'Genitourinary',
            'urethra': 'Genitourinary',
            'penis': 'Genitourinary',
            'scrotum': 'Genitourinary',

            # Gynecologic
            'gynecologic': 'Gynecologic',
            'gynecology': 'Gynecologic',
            'gyn': 'Gynecologic',
            'female genital tract': 'Gynecologic',
            'ovary': 'Gynecologic',
            'trophoblastic pathology': 'Gynecologic',

            # Hematopathology
            'hematopathology': 'Hematopathology',
            'hemepath': 'Hematopathology',
            'blood': 'Hematopathology',
            'bone marrow': 'Hematopathology',
            'white blood cells, lymph nodes, spleen, and thymus': 'Hematopathology',
            'lymphnodes': 'Hematopathology',
            'lymph node': 'Hematopathology',
            'lymph nodes': 'Hematopathology',
            'hematopoietic tumors': 'Hematopathology',

            # Head and Neck
            'head and neck': 'Head and Neck',
            'head & neck': 'Head and Neck',
            'headneck': 'Head and Neck',
            'ent': 'Head and Neck',
            'oral pathology': 'Head and Neck',
            'oral': 'Head and Neck',
            'oral cavity': 'Head and Neck',
            'salivary gland': 'Head and Neck',
            'salivary glands': 'Head and Neck',
            'salivarygland': 'Head and Neck',
            'parotid': 'Head and Neck',
            'larynx': 'Head and Neck',
            'larynx, trachea, hypopharynx': 'Head and Neck',
            'sinonasal and nasopharynx': 'Head and Neck',
            'sinus': 'Head and Neck',
            'neck': 'Head and Neck',
            'ear': 'Head and Neck',

            # Dermatology/Dermatopathology
            'dermatology': 'Dermatology',
            'dermatopathology': 'Dermatology',
            'skin': 'Dermatology',
            'cutaneous lymphomas and leukemias': 'Dermatology',
            'pediatric dermatopathology': 'Dermatology',
            'malignant melanoma': 'Dermatology',
            'mimicry in melanocytic lesions': 'Dermatology',
            'erythematous, papular and squamous diseases': 'Dermatology',
            'vesiculobullous and vesiculopustular diseases': 'Dermatology',
            'bacterial, mycobacterial, and treponemal diseases': 'Dermatology',
            'fungal, protozoal and parasitic diseases': 'Dermatology',
            'viral diseases': 'Dermatology',
            'cutaneous toxicities of drugs': 'Dermatology',
            'non-infectious and palisading granulomas': 'Dermatology',
            'connective tissue diseases': 'Dermatology',
            'vascular diseases': 'Dermatology',
            'panniculitis': 'Dermatology',
            'degerative, perforating and nutritional diseases': 'Dermatology',
            'tumors and cysts of the epidermis': 'Dermatology',
            'tumors of the epidermal appendages': 'Dermatology',
            'inflammatory dz of epid appendages and cartilage': 'Dermatology',
            'vascular tumors': 'Dermatology',
            'tumors of fibrous tissue': 'Dermatology',
            'histiocytoses': 'Dermatology',

            # Neuropathology
            'neuropathology': 'Neuropathology',
            'neuro': 'Neuropathology',
            'brain': 'Neuropathology',
            'central nervous system': 'Neuropathology',
            'peripheral nerve and skeletal muscle': 'Neuropathology',
            'tumors of neural tissue': 'Neuropathology',

            # Pulmonary
            'pulmonary': 'Pulmonary',
            'lung': 'Pulmonary',
            'respiratory tract': 'Pulmonary',
            'respiratory tract and mediastinum': 'Pulmonary',
            'thoracic': 'Pulmonary',

            # Endocrine
            'endocrine': 'Endocrine',
            'thyroid': 'Endocrine',

            # Ophthalmology
            'eye': 'Ophthalmology',
            'ophthalmology': 'Ophthalmology',
            'orbit': 'Ophthalmology',
            'orbit and lacrimal gland': 'Ophthalmology',
            'uvea': 'Ophthalmology',
            'retina': 'Ophthalmology',
            'conjunctiva': 'Ophthalmology',
            'eyelid': 'Ophthalmology',
            'lens': 'Ophthalmology',
            'cornea': 'Ophthalmology',
            'vitreous': 'Ophthalmology',
            'optic nerve': 'Ophthalmology',

            # Pediatric
            'pediatric': 'Pediatric',
            'pediatrics': 'Pediatric',
            'paidopathology': 'Pediatric',
            'perinatal': 'Pediatric',
            'congenital diseases': 'Pediatric',

            # Cytology
            'cytology': 'Cytology',
            'cerebrospinal fluid': 'Cytology',
            'pleural, pericardial, and peritoneal fluids': 'Cytology',
            'peritoneal washings': 'Cytology',

            # Obstetrics
            'obstetrics': 'Obstetrics',
            'maternal vascular malperfusion': 'Obstetrics',
            'fetal vascular malperfusion': 'Obstetrics',
            'acute insults': 'Obstetrics',

            # General/Miscellaneous
            'general': 'General',
            'others': 'General',
            'potpourri': 'General',
            'miscellaneous': 'General',
            'tumors': 'General',
            'pip': 'General',
            'infective diseases': 'General',
            'metastatic tumors': 'General',
            'malignant small round cell tumors': 'General',
            'miscellaneous mesenchymal tumors': 'General',
            'fibrous and fibrohistiocytic tumors': 'General',
            'tumors of fatty, osseous and muscular tissue': 'General',
            'benign cartilage tumors': 'General',
            'malignant cartilage tumors': 'General',
            'notochordal tumors': 'General',
            'publications': 'General',
            'softtissue': 'General',
        }

        self.organ_system_mapping = {
            # Clear empty/unknown values
            'unknown': '',
            'none provided': '',
            'potpourri': '',
            '': '',

            # Breast
            'breast': 'Breast',

            # Skin/Dermatology
            'dermatopathology': 'Skin',
            'skin': 'Skin',

            # Gastrointestinal
            'gastrointestinal tract': 'Gastrointestinal',
            'gastrointestinal': 'Gastrointestinal',
            'gi': 'Gastrointestinal',
            'stomach': 'Gastrointestinal',
            'large bowel': 'Gastrointestinal',
            'small bowel': 'Gastrointestinal',
            'colon': 'Gastrointestinal',
            'rectum': 'Gastrointestinal',
            'esophagus': 'Gastrointestinal',
            'duodenum': 'Gastrointestinal',
            'jejunum': 'Gastrointestinal',
            'ileum': 'Gastrointestinal',
            'cecum': 'Gastrointestinal',
            'appendix': 'Gastrointestinal',
            'anus': 'Gastrointestinal',
            'intestine': 'Gastrointestinal',
            'intestines': 'Gastrointestinal',
            'small intestine': 'Gastrointestinal',
            'sigmoid colon': 'Gastrointestinal',
            'transverse': 'Gastrointestinal',
            'rectosigmoid': 'Gastrointestinal',
            'ileocecal valve': 'Gastrointestinal',
            'gastroesophageal': 'Gastrointestinal',

            # Liver and Biliary
            'liver': 'Liver',
            'liver and biliary tract': 'Liver',
            'gallbladder': 'Liver',
            'bile duct': 'Liver',
            'biliary': 'Liver',

            # Pancreas
            'pancreas': 'Pancreas',
            'pancreatic': 'Pancreas',
            'pancreatobiliary': 'Pancreas',
            'pancreas and biliary tree': 'Pancreas',
            'head of pancreas': 'Pancreas',
            'tail of pancreas': 'Pancreas',
            'pancreatic islets': 'Pancreas',
            'islet cell': 'Pancreas',
            'ampulla of vater': 'Pancreas',
            'papilla of vater': 'Pancreas',

            # Lung/Pulmonary
            'lung': 'Lung',
            'pulmonary': 'Lung',
            'respiratory tract': 'Lung',
            'respiratory tract and mediastinum': 'Lung',
            'thoracic': 'Lung',
            'bronchus': 'Lung',
            'pleura': 'Lung',
            'mediastinum': 'Lung',
            'thymus': 'Lung',
            'trachea': 'Lung',
            'chest wall': 'Lung',
            'anterior mediastinum': 'Lung',
            'mediastinal': 'Lung',

            # Genitourinary - Kidney
            'kidney': 'Kidney',
            'renal': 'Kidney',
            'adrenal': 'Adrenal',
            'adrenal gland': 'Adrenal',

            # Genitourinary - Bladder/Urinary
            'bladder': 'Bladder',
            'urinary bladder': 'Bladder',
            'urethra': 'Bladder',
            'ureter': 'Bladder',
            'renal pelvis': 'Bladder',
            'lower urinary tract': 'Bladder',

            # Male Genital
            'testis': 'Testis',
            'testicle': 'Testis',
            'testicular': 'Testis',
            'prostate': 'Prostate',
            'penis': 'Penis',
            'scrotum': 'Scrotum',
            'epididymis': 'Testis',
            'spermatic cord': 'Testis',
            'seminal vesicle': 'Prostate',
            'lower urinary tract and male genital system': 'Male Genital System',
            'male genital system': 'Male Genital System',

            # Female Genital
            'ovary': 'Ovary',
            'ovarian': 'Ovary',
            'uterus': 'Uterus',
            'cervix': 'Cervix',
            'endometrium': 'Uterus',
            'myometrium': 'Uterus',
            'fallopian tube': 'Fallopian Tube',
            'vulva': 'Vulva',
            'vagina': 'Vagina',
            'placenta': 'Placenta',
            'female genital tract': 'Female Genital Tract',
            'gynecologic': 'Female Genital Tract',
            'gyn': 'Female Genital Tract',
            'corpus': 'Uterus',
            'adnexae': 'Ovary',
            'labia': 'Vulva',

            # Hematopathology/Lymphoid
            'hematopathology': 'Blood',
            'blood': 'Blood',
            'bone marrow': 'Bone Marrow',
            'spleen': 'Spleen',
            'lymph nodes': 'Lymph Nodes',
            'lymph node': 'Lymph Nodes',
            'lymphnodes': 'Lymph Nodes',
            'white blood cells, lymph nodes, spleen, and thymus': 'Lymphoid System',
            'lymphoid system': 'Lymphoid System',
            'red blood cells': 'Blood',

            # Bone and Soft Tissue
            'bone': 'Bone',
            'soft tissue': 'Soft Tissue',
            'soft tissues': 'Soft Tissue',
            'bones, joints, and soft-tissue tumours': 'Bone and Soft Tissue',
            'bone and soft tissue': 'Bone and Soft Tissue',
            'skeletal muscle': 'Soft Tissue',
            'muscle': 'Soft Tissue',
            'cartilage': 'Bone',
            'joint': 'Bone',
            'tendon': 'Soft Tissue',

            # Central Nervous System
            'central nervous system': 'Central Nervous System',
            'brain': 'Central Nervous System',
            'cns': 'Central Nervous System',
            'neuropathology': 'Central Nervous System',
            'cerebrum': 'Central Nervous System',
            'cerebellum': 'Central Nervous System',
            'pituitary': 'Central Nervous System',
            'pineal': 'Central Nervous System',
            'spinal cord': 'Central Nervous System',
            'peripheral nerve': 'Peripheral Nerve',
            'nerve': 'Peripheral Nerve',

            # Head and Neck
            'head and neck': 'Head and Neck',
            'oral cavity': 'Head and Neck',
            'tongue': 'Head and Neck',
            'salivary glands': 'Head and Neck',
            'salivary gland': 'Head and Neck',
            'parotid': 'Head and Neck',
            'submandibular': 'Head and Neck',
            'larynx': 'Head and Neck',
            'pharynx': 'Head and Neck',
            'nasopharynx': 'Head and Neck',
            'nasal cavity': 'Head and Neck',
            'sinus': 'Head and Neck',
            'maxillary': 'Head and Neck',
            'mandible': 'Head and Neck',
            'neck': 'Head and Neck',
            'ear': 'Head and Neck',
            'tonsil': 'Head and Neck',
            'vocal cord': 'Head and Neck',
            'epiglottis': 'Head and Neck',
            'palate': 'Head and Neck',
            'lip': 'Head and Neck',
            'cheek': 'Head and Neck',
            'face': 'Head and Neck',
            'scalp': 'Head and Neck',

            # Endocrine
            'thyroid': 'Thyroid',
            'parathyroid': 'Thyroid',
            'endocrine': 'Endocrine',

            # Eye/Ophthalmology
            'eye': 'Eye',
            'orbit': 'Eye',
            'eyelid': 'Eye',
            'conjunctiva': 'Eye',
            'retina': 'Eye',
            'cornea': 'Eye',
            'lens': 'Eye',
            'vitreous': 'Eye',
            'optic nerve': 'Eye',
            'lacrimal': 'Eye',
            'ophthalmology': 'Eye',

            # Cardiovascular
            'heart': 'Heart',
            'pericardium': 'Heart',
            'blood vessels': 'Blood Vessels',
            'aorta': 'Blood Vessels',
            'artery': 'Blood Vessels',
            'vein': 'Blood Vessels',
            'cardiovascular': 'Cardiovascular',

            # Cytology/Effusions
            'cytology': 'Cytology',
            'pleural': 'Cytology',
            'peritoneal': 'Cytology',
            'pericardial': 'Cytology',
            'cerebrospinal': 'Cytology',
            'effusion': 'Cytology',
            'ascites': 'Cytology',

            # Peritoneum/Retroperitoneum
            'peritoneum': 'Peritoneum',
            'retroperitoneum': 'Retroperitoneum',
            'omentum': 'Peritoneum',
            'mesentery': 'Peritoneum',

            # Anatomical locations that should be simplified
            'thigh': 'Soft Tissue',
            'arm': 'Soft Tissue',
            'leg': 'Soft Tissue',
            'back': 'Soft Tissue',
            'chest': 'Soft Tissue',
            'abdomen': 'Soft Tissue',
            'pelvis': 'Soft Tissue',
            'groin': 'Soft Tissue',
            'axilla': 'Soft Tissue',
            'shoulder': 'Soft Tissue',
            'knee': 'Soft Tissue',
            'ankle': 'Soft Tissue',
            'foot': 'Soft Tissue',
            'hand': 'Soft Tissue',
            'finger': 'Soft Tissue',
            'wrist': 'Soft Tissue',
            'elbow': 'Soft Tissue',
            'hip': 'Soft Tissue',
            'buttock': 'Soft Tissue',
            'forearm': 'Soft Tissue',
            'calf': 'Soft Tissue',
        }

        self.consolidated_cases = []
        self.case_counter = 1
    
    def normalize_category(self, category_text: str) -> str:
        """Normalize category text to standard format."""
        if not category_text:
            return 'General'
        
        # Clean up the text
        clean_text = re.sub(r'\([^)]*\)', '', category_text).strip().lower()
        
        # Check for exact matches first
        if clean_text in self.category_mapping:
            return self.category_mapping[clean_text]
        
        # Check for partial matches
        for key, value in self.category_mapping.items():
            if key in clean_text:
                return value
        
        # Return title case if no match found
        return category_text.title()

    def normalize_organ_system(self, organ_text: str) -> str:
        """Normalize organ system text to standard format."""
        if not organ_text:
            return ''

        # Clean up the text - remove parentheses, extra spaces, and convert to lowercase
        clean_text = re.sub(r'\([^)]*\)', '', organ_text).strip().lower()
        clean_text = re.sub(r'\s+', ' ', clean_text)  # Replace multiple spaces with single space
        clean_text = re.sub(r'[^\w\s]', ' ', clean_text)  # Replace non-alphanumeric chars with space
        clean_text = clean_text.strip()

        # Check for exact matches first
        if clean_text in self.organ_system_mapping:
            return self.organ_system_mapping[clean_text]

        # Check for partial matches - prioritize longer matches
        matches = []
        for key, value in self.organ_system_mapping.items():
            if key and key in clean_text:
                matches.append((len(key), value))

        if matches:
            # Return the value from the longest matching key
            matches.sort(reverse=True)
            return matches[0][1]

        # Special handling for common patterns
        if 'yo' in clean_text and ('male' in clean_text or 'female' in clean_text):
            return ''  # Age/gender descriptions, not organ systems

        if 'year old' in clean_text:
            return ''  # Age descriptions

        if any(word in clean_text for word in ['history', 'hx', 'with', 'mass', 'tumor', 'lesion', 'nodule']):
            return ''  # Clinical descriptions, not organ systems

        # If it's a very long string (likely clinical description), return empty
        if len(clean_text) > 50:
            return ''

        # Return empty for unrecognized organ systems to avoid clutter
        return ''

    def extract_age_gender(self, text: str) -> Tuple[str, str]:
        """Extract age and gender from text."""
        age = gender = ""
        
        if not text:
            return age, gender
        
        # Extract age
        age_patterns = [
            r'(\d+)\s*(?:years?|yrs?|y\.o\.?)',
            r'(\d+)\s*(?:months?|mos?)',
            r'(\d+)\s*(?:days?)',
            r'(\d+)\s*(?:weeks?|wks?)'
        ]
        
        for pattern in age_patterns:
            match = re.search(pattern, text.lower())
            if match:
                age = match.group(1)
                if 'month' in text.lower():
                    age += ' months'
                elif 'day' in text.lower():
                    age += ' days'
                elif 'week' in text.lower():
                    age += ' weeks'
                else:
                    age += ' years'
                break
        
        # Extract gender
        if re.search(r'\bfemale\b|\bf\b', text.lower()):
            gender = 'Female'
        elif re.search(r'\bmale\b|\bm\b', text.lower()):
            gender = 'Male'
        
        return age, gender
    
    def create_unified_case(self, **kwargs) -> Dict[str, Any]:
        """Create a unified case structure."""
        # Combine diagnosis with clinical details for richer information
        diagnosis_parts = []
        if kwargs.get('diagnosis'):
            diagnosis_parts.append(kwargs.get('diagnosis'))

        # Add clinical information to diagnosis if available
        clinical_fields = [
            kwargs.get('clinical_info', ''),
            kwargs.get('clinical_details', ''),
            kwargs.get('clinical_history', ''),
            kwargs.get('history', ''),
            kwargs.get('description', '')
        ]

        for field in clinical_fields:
            if field and field.strip() and field.strip() not in diagnosis_parts:
                diagnosis_parts.append(field.strip())

        # Create patient info string (age + gender)
        patient_info_parts = []
        if kwargs.get('age'):
            patient_info_parts.append(kwargs.get('age'))
        if kwargs.get('gender'):
            patient_info_parts.append(kwargs.get('gender'))

        case = {
            'id': f"case_{self.case_counter:06d}",
            'repository': kwargs.get('repository', 'Unknown'),
            'category': self.normalize_category(kwargs.get('category', '')),
            'organ_system': self.normalize_organ_system(kwargs.get('organ_system', '')),
            'diagnosis': ' • '.join(diagnosis_parts) if diagnosis_parts else '',
            'patient_info': ', '.join(patient_info_parts) if patient_info_parts else '',
            'age': kwargs.get('age', ''),
            'gender': kwargs.get('gender', ''),
            'slide_urls': kwargs.get('slide_urls', []),
            'preview_urls': kwargs.get('preview_urls', []),
            'case_url': kwargs.get('case_url', ''),
            'stain': kwargs.get('stain', ''),
            'source_metadata': kwargs.get('source_metadata', {})
        }

        self.case_counter += 1
        return case
    
    def process_leeds_data(self, data: List[Dict]) -> None:
        """Process Leeds Virtual Pathology data."""
        for item in data:
            age, gender = self.extract_age_gender(item.get('patient_info', ''))

            case = self.create_unified_case(
                repository='Leeds Virtual Pathology',
                category='Breast',
                organ_system='Breast',
                diagnosis=item.get('diagnosis', ''),
                clinical_details=item.get('clinical_details', ''),
                age=age,
                gender=gender,
                slide_urls=item.get('slide_urls', []),
                preview_urls=item.get('preview_image_urls', []),
                source_metadata={'system': item.get('system', '')}
            )
            self.consolidated_cases.append(case)
    
    def process_hematopathology_data(self, data: Dict) -> None:
        """Process Hematopathology eTutorial data."""
        for lesson in data.get('lessons', []):
            lesson_title = lesson.get('title', '')
            
            for slide in lesson.get('slides', []):
                case = self.create_unified_case(
                    repository='Hematopathology eTutorial',
                    category='Hematopathology',
                    organ_system=slide.get('specimen_type', 'Blood'),
                    diagnosis=slide.get('title', ''),
                    clinical_info=f"Lesson: {lesson_title}",
                    slide_urls=[f"https://hematopathology.com{slide.get('url', '')}"] if slide.get('url') else [],
                    source_metadata={
                        'lesson_number': lesson.get('lesson_number'),
                        'slide_id': slide.get('id')
                    }
                )
                self.consolidated_cases.append(case)
    
    def process_mgh_data(self, data: List[Dict]) -> None:
        """Process MGH Pathology data."""
        for item in data:
            subsection = item.get('subsection', '')
            category = subsection.split('(')[0].strip() if '(' in subsection else subsection

            case = self.create_unified_case(
                repository='MGH Pathology',
                category=category,
                organ_system=item.get('clinical_history', ''),
                diagnosis=item.get('diagnosis', ''),
                clinical_history=item.get('clinical_history', ''),
                case_url=item.get('case_url', ''),
                preview_urls=[item.get('preview_image_url', '')] if item.get('preview_image_url') else [],
                source_metadata={
                    'section': item.get('section', ''),
                    'case_name': item.get('case_name', '')
                }
            )
            self.consolidated_cases.append(case)
    
    def process_pathpresenter_data(self, data: List[Dict]) -> None:
        """Process PathPresenter data."""
        for item in data:
            case = self.create_unified_case(
                repository='PathPresenter',
                category=item.get('section', ''),
                diagnosis=item.get('diagnosis', ''),
                case_url=item.get('case_url', ''),
                stain=item.get('stain', ''),
                preview_urls=item.get('image_urls', []),
                source_metadata={
                    'case_id': item.get('case_id', ''),
                    'slide_type': item.get('slide_type', '')
                }
            )
            self.consolidated_cases.append(case)
    
    def process_recutclub_data(self, data: List[Dict]) -> None:
        """Process Recut Club data."""
        for item in data:
            history = item.get('history', '')
            age, gender = self.extract_age_gender(history)

            case = self.create_unified_case(
                repository='Recut Club',
                category=item.get('topic', ''),
                organ_system=item.get('topic', ''),
                diagnosis=item.get('diagnosis', ''),
                history=history,
                age=age,
                gender=gender,
                case_url=item.get('case_url', ''),
                preview_urls=[item.get('image_url', '')] if item.get('image_url') else [],
                source_metadata={
                    'conference': item.get('conference', ''),
                    'case_title': item.get('case_title', '')
                }
            )
            self.consolidated_cases.append(case)
    
    def process_rosai_data(self, data: List[Dict]) -> None:
        """Process Rosai Collection data."""
        for item in data:
            case = self.create_unified_case(
                repository='Rosai Collection',
                category=item.get('category', ''),
                organ_system=item.get('location', ''),
                diagnosis=item.get('diagnosis_clean', item.get('diagnosis', '')),
                description=item.get('description', ''),
                slide_urls=[item.get('slide_url', '')] if item.get('slide_url') else [],
                preview_urls=[item.get('thumbnail_url', '')] if item.get('thumbnail_url') else [],
                source_metadata={
                    'seminar_title': item.get('seminar_title', ''),
                    'case_id': item.get('case_id', '')
                }
            )
            self.consolidated_cases.append(case)
    
    def process_toronto_data(self, data: List[Dict]) -> None:
        """Process University of Toronto LMP data."""
        for item in data:
            case = self.create_unified_case(
                repository='University of Toronto LMP',
                category=item.get('organ_system', ''),
                organ_system=item.get('organ_system', ''),
                diagnosis=item.get('diagnosis', ''),
                age=item.get('age', ''),
                gender=item.get('gender', ''),
                case_url=item.get('case_url', ''),
                preview_urls=[item.get('thumbnail_url', '')] if item.get('thumbnail_url') else [],
                source_metadata={
                    'lmp_id': item.get('lmp_id', ''),
                    'diagnostic_modality': item.get('diagnostic_modality', '')
                }
            )
            self.consolidated_cases.append(case)
    
    def process_file(self, filepath: Path) -> None:
        """Process a single JSON file based on its name."""
        if not filepath.exists():
            print(f"Warning: {filepath.name} not found")
            return
        
        print(f"Processing {filepath.name}...")
        
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # Route to appropriate processor based on filename
            if 'leeds' in filepath.name.lower():
                self.process_leeds_data(data)
            elif 'hematopathology' in filepath.name.lower():
                self.process_hematopathology_data(data)
            elif 'mgh' in filepath.name.lower():
                self.process_mgh_data(data)
            elif 'pathpresenter' in filepath.name.lower():
                self.process_pathpresenter_data(data)
            elif 'recutclub' in filepath.name.lower():
                self.process_recutclub_data(data)
            elif 'rosai' in filepath.name.lower():
                self.process_rosai_data(data)
            elif 'toronto' in filepath.name.lower():
                self.process_toronto_data(data)
            else:
                print(f"  Unknown file type: {filepath.name}")
                return
            
            print(f"  Processed {filepath.name} successfully")
            
        except Exception as e:
            print(f"  Error processing {filepath.name}: {e}")
    
    def consolidate_all(self, input_directory: Path, output_file: Path) -> None:
        """Consolidate all JSON files in the input directory."""
        json_files = list(input_directory.glob('*.json'))
        
        if not json_files:
            print("No JSON files found in the input directory")
            return
        
        for json_file in json_files:
            self.process_file(json_file)
        
        # Write consolidated data
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(self.consolidated_cases, f, indent=2, ensure_ascii=False)
        
        print(f"\nConsolidated {len(self.consolidated_cases)} cases into {output_file}")
        
        # Print statistics
        self.print_statistics()
    
    def print_statistics(self) -> None:
        """Print statistics about the consolidated data."""
        if not self.consolidated_cases:
            return
        
        # Count by repository
        repos = {}
        categories = {}
        
        for case in self.consolidated_cases:
            repo = case.get('repository', 'Unknown')
            cat = case.get('category', 'Unknown')
            
            repos[repo] = repos.get(repo, 0) + 1
            categories[cat] = categories.get(cat, 0) + 1
        
        print(f"\nRepositories ({len(repos)}):")
        for repo, count in sorted(repos.items(), key=lambda x: x[1], reverse=True):
            print(f"  {repo}: {count} cases")
        
        print(f"\nCategories ({len(categories)}):")
        for cat, count in sorted(categories.items(), key=lambda x: x[1], reverse=True):
            print(f"  {cat}: {count} cases")
        
        # Count cases with various fields
        with_diagnosis = sum(1 for case in self.consolidated_cases if case.get('diagnosis'))
        with_clinical = sum(1 for case in self.consolidated_cases if case.get('clinical_info'))
        with_slides = sum(1 for case in self.consolidated_cases if case.get('slide_urls'))
        with_previews = sum(1 for case in self.consolidated_cases if case.get('preview_urls'))
        
        print(f"\nData completeness:")
        print(f"  Cases with diagnosis: {with_diagnosis}/{len(self.consolidated_cases)} ({with_diagnosis/len(self.consolidated_cases)*100:.1f}%)")
        print(f"  Cases with clinical info: {with_clinical}/{len(self.consolidated_cases)} ({with_clinical/len(self.consolidated_cases)*100:.1f}%)")
        print(f"  Cases with slide URLs: {with_slides}/{len(self.consolidated_cases)} ({with_slides/len(self.consolidated_cases)*100:.1f}%)")
        print(f"  Cases with preview URLs: {with_previews}/{len(self.consolidated_cases)} ({with_previews/len(self.consolidated_cases)*100:.1f}%)")


def main():
    """Main function."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Consolidate virtual slide data from multiple sources')
    parser.add_argument('--input-dir', type=Path, default=Path('.'), 
                       help='Directory containing input JSON files (default: current directory)')
    parser.add_argument('--output', type=Path, default=Path('consolidated_virtual_slides.json'),
                       help='Output file path (default: consolidated_virtual_slides.json)')
    
    args = parser.parse_args()
    
    consolidator = VirtualSlidesConsolidator()
    consolidator.consolidate_all(args.input_dir, args.output)


if __name__ == "__main__":
    main()