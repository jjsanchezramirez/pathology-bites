#!/usr/bin/env python3
"""
Script to count end tree items (leaf nodes) by designation in the content specifications.
"""

import json
from collections import defaultdict

def count_items_recursive(items, counts, path=""):
    """Recursively count items by designation, only counting leaf nodes."""
    if not items:
        return
    
    for i, item in enumerate(items):
        current_path = f"{path}.{i}" if path else str(i)
        
        # Check if this item has subitems (children)
        has_children = item.get('subitems') and len(item.get('subitems', [])) > 0
        
        if has_children:
            # This is not a leaf node, recurse into children
            count_items_recursive(item['subitems'], counts, current_path)
        else:
            # This is a leaf node, count it
            designation = item.get('designation', 'None')
            counts[designation] += 1
            
            # Print some examples for verification
            if counts[designation] <= 3:  # Show first 3 examples of each type
                print(f"  {designation}: {item.get('title', 'No title')} (Section path: {current_path})")

def analyze_pathology_data():
    """Analyze the pathology outlines data and count designations."""
    
    # Load the merged JSON data
    try:
        with open('data/content-specs/content_specifications_merged.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
    except FileNotFoundError:
        print("Error: content_specifications_merged.json not found in data/content-specs/ directory")
        return
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON: {e}")
        return
    
    if 'content_specifications' not in data:
        print("Error: 'content_specifications' key not found in data")
        return

    # Combine AP and CP sections
    ap_sections = data['content_specifications'].get('ap_sections', [])
    cp_sections = data['content_specifications'].get('cp_sections', [])
    sections = ap_sections + cp_sections
    total_counts = defaultdict(int)

    print("Analyzing content specifications data...")
    print("=" * 60)
    
    # Process each section
    for section_idx, section in enumerate(sections):
        section_num = section.get('section', 'Unknown')
        section_title = section.get('title', 'Unknown')
        section_type = section.get('type', 'unknown').upper()

        print(f"\n{section_type} Section {section_num}: {section_title}")
        print("-" * 50)
        
        section_counts = defaultdict(int)
        
        # Handle sections with direct items
        if 'items' in section and section['items']:
            count_items_recursive(section['items'], section_counts, f"S{section_num}")
        
        # Handle sections with subsections
        if 'subsections' in section and section['subsections']:
            for subsection_idx, subsection in enumerate(section['subsections']):
                subsection_letter = subsection.get('letter', 'Unknown')
                subsection_title = subsection.get('title', 'Unknown')
                print(f"  Subsection {subsection_letter}: {subsection_title}")
                
                if 'items' in subsection and subsection['items']:
                    count_items_recursive(
                        subsection['items'],
                        section_counts,
                        f"S{section_num}.{subsection_letter}"
                    )

                # Handle sections within subsections (like digestive system)
                if 'sections' in subsection and subsection['sections']:
                    for sub_section in subsection['sections']:
                        sub_section_title = sub_section.get('title', 'Unknown')
                        print(f"    Section: {sub_section_title}")

                        if 'items' in sub_section and sub_section['items']:
                            count_items_recursive(
                                sub_section['items'],
                                section_counts,
                                f"S{section_num}.{subsection_letter}.{sub_section_title}"
                            )
        
        # Add section counts to total
        for designation, count in section_counts.items():
            total_counts[designation] += count
        
        # Print section summary
        if section_counts:
            print(f"  Section {section_num} totals:")
            for designation in sorted(section_counts.keys()):
                print(f"    {designation}: {section_counts[designation]} items")
        else:
            print(f"  Section {section_num}: No items found")
    
    # Print final summary
    print("\n" + "=" * 60)
    print("FINAL SUMMARY - End Tree Items (Leaf Nodes) by Designation:")
    print("=" * 60)
    
    # Sort designations for consistent output
    sorted_designations = sorted(total_counts.keys())
    
    for designation in sorted_designations:
        count = total_counts[designation]
        designation_name = {
            'C': 'Core',
            'AR': 'Advanced/Resident', 
            'F': 'Fellowship',
            'None': 'No Designation'
        }.get(designation, designation)
        
        print(f"{designation_name:20} ({designation:>4}): {count:>6} items")
    
    total_items = sum(total_counts.values())
    print(f"{'Total Items':20} {'':>4}: {total_items:>6} items")
    
    # Calculate percentages
    print("\nPercentage Distribution:")
    print("-" * 30)
    for designation in sorted_designations:
        count = total_counts[designation]
        percentage = (count / total_items * 100) if total_items > 0 else 0
        designation_name = {
            'C': 'Core',
            'AR': 'Advanced/Resident', 
            'F': 'Fellowship',
            'None': 'No Designation'
        }.get(designation, designation)
        print(f"{designation_name:20}: {percentage:>5.1f}%")
    
    # Answer the specific question
    print("\n" + "=" * 60)
    print("ANSWER TO YOUR QUESTION:")
    print("=" * 60)
    core_count = total_counts.get('C', 0)
    ar_count = total_counts.get('AR', 0)
    print(f"Core (C) items:              {core_count:>6}")
    print(f"Advanced/Resident (AR) items: {ar_count:>6}")
    print(f"Combined C + AR items:        {core_count + ar_count:>6}")

if __name__ == '__main__':
    analyze_pathology_data()
