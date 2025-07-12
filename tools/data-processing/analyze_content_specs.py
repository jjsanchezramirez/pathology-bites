#!/usr/bin/env python3
"""
Script to analyze the merged content specifications file.
"""

import json
from collections import defaultdict

def count_designations_recursive(obj, counts):
    """Recursively count designations in nested structures."""
    if isinstance(obj, dict):
        if 'designation' in obj:
            designation = obj['designation']
            counts[designation] += 1
        
        # Recurse through all values
        for value in obj.values():
            count_designations_recursive(value, counts)
    
    elif isinstance(obj, list):
        # Recurse through all items in list
        for item in obj:
            count_designations_recursive(item, counts)

def check_section_sequences(data):
    """Check for sequence breaks in AP and CP sections."""
    ap_sections = data['content_specifications']['ap_sections']
    cp_sections = data['content_specifications']['cp_sections']
    
    print("AP Section Sequence Check:")
    ap_numbers = [s['section'] for s in ap_sections]
    ap_numbers.sort()
    print(f"AP sections found: {ap_numbers}")
    
    # Check for gaps
    expected_ap = list(range(1, max(ap_numbers) + 1))
    missing_ap = [n for n in expected_ap if n not in ap_numbers]
    if missing_ap:
        print(f"Missing AP sections: {missing_ap}")
    else:
        print("No gaps in AP section sequence")
    
    print("\nCP Section Sequence Check:")
    cp_numbers = [s['section'] for s in cp_sections]
    cp_numbers.sort()
    print(f"CP sections found: {cp_numbers}")
    
    # Check for gaps
    expected_cp = list(range(1, max(cp_numbers) + 1))
    missing_cp = [n for n in expected_cp if n not in cp_numbers]
    if missing_cp:
        print(f"Missing CP sections: {missing_cp}")
    else:
        print("No gaps in CP section sequence")

def check_content_presence(data):
    """Check which sections have content."""
    ap_sections = data['content_specifications']['ap_sections']
    cp_sections = data['content_specifications']['cp_sections']

    print("\nContent Presence Check:")
    print("AP Sections:")
    for section in ap_sections:
        has_items = 'items' in section and len(section.get('items', [])) > 0
        has_subsections = 'subsections' in section and len(section.get('subsections', [])) > 0

        # Count items in subsections if present
        subsection_item_count = 0
        if has_subsections:
            for subsection in section.get('subsections', []):
                if 'items' in subsection:
                    subsection_item_count += len(subsection.get('items', []))

        content_status = "HAS CONTENT" if (has_items or has_subsections) else "EMPTY"
        if has_subsections and subsection_item_count > 0:
            content_status += f" ({subsection_item_count} items in subsections)"
        elif has_items:
            content_status += f" ({len(section.get('items', []))} direct items)"

        print(f"  Section {section['section']}: {section['title']} - {content_status}")

    print("\nCP Sections:")
    for section in cp_sections:
        has_items = 'items' in section and len(section.get('items', [])) > 0
        has_subsections = 'subsections' in section and len(section.get('subsections', [])) > 0

        # Count items in subsections if present
        subsection_item_count = 0
        if has_subsections:
            for subsection in section.get('subsections', []):
                if 'items' in subsection:
                    subsection_item_count += len(subsection.get('items', []))

        content_status = "HAS CONTENT" if (has_items or has_subsections) else "EMPTY"
        if has_subsections and subsection_item_count > 0:
            content_status += f" ({subsection_item_count} items in subsections)"
        elif has_items:
            content_status += f" ({len(section.get('items', []))} direct items)"

        print(f"  Section {section['section']}: {section['title']} - {content_status}")

def main():
    # Load the merged JSON file
    with open('src/data/content_specifications_merged.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Check section sequences
    check_section_sequences(data)
    
    # Check content presence
    check_content_presence(data)
    
    # Count designations
    counts = defaultdict(int)
    count_designations_recursive(data, counts)
    
    print(f"\nDesignation Counts:")
    print(f"C (Core/Foundational Knowledge): {counts['C']}")
    print(f"AR (Advanced Resident): {counts['AR']}")
    print(f"F (Fellow/Advanced Practitioner): {counts['F']}")
    print(f"Total items with designations: {sum(counts.values())}")
    
    # Show breakdown by section type
    ap_counts = defaultdict(int)
    cp_counts = defaultdict(int)
    
    count_designations_recursive(data['content_specifications']['ap_sections'], ap_counts)
    count_designations_recursive(data['content_specifications']['cp_sections'], cp_counts)
    
    print(f"\nAP Section Designations:")
    print(f"  C: {ap_counts['C']}, AR: {ap_counts['AR']}, F: {ap_counts['F']}")
    print(f"  Total: {sum(ap_counts.values())}")
    
    print(f"\nCP Section Designations:")
    print(f"  C: {cp_counts['C']}, AR: {cp_counts['AR']}, F: {cp_counts['F']}")
    print(f"  Total: {sum(cp_counts.values())}")

if __name__ == '__main__':
    main()
