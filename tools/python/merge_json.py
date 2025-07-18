#!/usr/bin/env python3
"""
Script to merge all JSON files from the ap and cp folders into a single JSON file.
"""

import json
from pathlib import Path

def load_json_file(filepath):
    """Load and return JSON data from a file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    return json.loads(content)

def normalize_ap_section(section_data):
    """Normalize AP section data to standard format."""
    normalized = {
        'section': section_data['section'],
        'title': section_data['title'],
        'type': 'ap'
    }

    # Handle different AP structures
    if 'items' in section_data:
        normalized['items'] = section_data['items']

    if 'subsections' in section_data:
        normalized['subsections'] = section_data['subsections']

    # Include other fields that might be present
    for field in ['line', 'starting_line', 'note']:
        if field in section_data:
            normalized[field] = section_data[field]

    return normalized

def normalize_cp_section(section_data, filename):
    """Normalize CP section data to standard format."""
    # Extract section number from filename
    section_number = extract_section_number_from_filename(filename)

    # CP files have different structures
    if 'document' in section_data:
        # Format 1: Document wrapper with sections inside (like blood banking)
        document = section_data['document']
        sections = []

        for section in document.get('sections', []):
            normalized_section = {
                'section': section['section'],
                'title': section['title'],
                'subsections': section.get('subsections', []),
                'type': 'cp',
                'source_file': filename
            }
            sections.append(normalized_section)

        return sections
    elif 'section' in section_data:
        # Format 2: Direct section format (like chemical pathology, hematopathology, etc.)
        normalized_section = {
            'section': section_number,
            'title': section_data['section'],
            'type': 'cp',
            'source_file': filename
        }

        # Handle different content structures
        if 'items' in section_data:
            normalized_section['items'] = section_data['items']
        if 'subsections' in section_data:
            normalized_section['subsections'] = section_data['subsections']
        if 'note' in section_data:
            normalized_section['note'] = section_data['note']
        if 'line' in section_data:
            normalized_section['line'] = section_data['line']

        return [normalized_section]

    return []

def extract_section_number_from_filename(filename):
    """Extract section number from CP filename."""
    # Map CP filenames to section numbers (1-5 for CP)
    cp_section_mapping = {
        '1_blood_banking.json': 1,
        '2_chemical_pathology.json': 2,
        '3_hematopathology.json': 3,
        '4_medical_microbiology.json': 4,
        '5_management_informatics.json': 5
    }
    return cp_section_mapping.get(filename, 1)

def main():
    # Paths to the JSON folders
    ap_folder = Path('src/data/question-specs/ap')
    cp_folder = Path('src/data/question-specs/cp')

    if not ap_folder.exists():
        print(f"Error: {ap_folder} does not exist")
        return

    if not cp_folder.exists():
        print(f"Error: {cp_folder} does not exist")
        return

    # Get all JSON files from both folders
    ap_files = sorted(ap_folder.glob('*.json'))
    cp_files = sorted(cp_folder.glob('*.json'))

    all_files = ap_files + cp_files

    if not all_files:
        print("No JSON files found in ap or cp folders")
        return

    print(f"Found {len(all_files)} JSON files to merge:")
    print(f"  AP files: {len(ap_files)}")
    print(f"  CP files: {len(cp_files)}")

    # Load and normalize all JSON files
    all_sections = []

    # Process AP files
    for json_file in ap_files:
        try:
            data = load_json_file(json_file)
            normalized_section = normalize_ap_section(data)
            all_sections.append(normalized_section)
            print(f"Loaded AP: {json_file.name}")
        except Exception as e:
            print(f"Error loading {json_file.name}: {e}")
            continue

    # Process CP files
    for json_file in cp_files:
        try:
            data = load_json_file(json_file)
            normalized_sections = normalize_cp_section(data, json_file.name)
            all_sections.extend(normalized_sections)
            print(f"Loaded CP: {json_file.name} ({len(normalized_sections)} sections)")
        except Exception as e:
            print(f"Error loading {json_file.name}: {e}")
            continue

    # Sort sections by section number
    all_sections.sort(key=lambda x: x['section'])

    # Clean up temporary source_file fields
    for section in all_sections:
        if 'source_file' in section:
            del section['source_file']

    # Create the final structure
    merged_data = {
        'content_specifications': {
            'ap_sections': [s for s in all_sections if s.get('type') == 'ap'],
            'cp_sections': [s for s in all_sections if s.get('type') == 'cp']
        },
        'metadata': {
            'total_sections': len(all_sections),
            'ap_sections': len([s for s in all_sections if s.get('type') == 'ap']),
            'cp_sections': len([s for s in all_sections if s.get('type') == 'cp']),
            'source_files': len(all_files),
            'description': 'Merged content specifications from AP and CP JSON files'
        }
    }

    # Write the merged JSON
    output_file = 'src/data/content_specifications_merged.json'

    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(merged_data, f, indent=2, ensure_ascii=False)

        print(f"\nSuccessfully merged {len(all_files)} files into {output_file}")
        print(f"Total sections in merged file: {len(all_sections)}")
        print(f"  AP sections: {merged_data['metadata']['ap_sections']}")
        print(f"  CP sections: {merged_data['metadata']['cp_sections']}")

        # Print section summary
        print("\nSections included:")
        for section in all_sections:
            section_type = section.get('type', 'unknown').upper()
            print(f"  {section_type} Section {section['section']}: {section['title']}")

    except Exception as e:
        print(f"Error writing merged file: {e}")

if __name__ == '__main__':
    main()
