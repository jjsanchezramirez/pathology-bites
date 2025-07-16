#!/usr/bin/env python3
"""
Extract and organize categories and organ systems from unified virtual slides data.
"""

import json
from collections import Counter
from pathlib import Path

def main():
    """Extract categories and organ systems from unified data."""
    script_dir = Path(__file__).parent
    unified_file = script_dir.parent / 'virtual-slides-unified.json'
    
    if not unified_file.exists():
        print(f"Error: {unified_file} not found")
        return
    
    print("Loading unified virtual slides data...")
    with open(unified_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Extract categories and organ systems
    categories = []
    organ_systems = []
    
    for case in data:
        category = case.get('category', '').strip()
        organ_system = case.get('organ_system', '').strip()
        
        if category:
            categories.append(category)
        if organ_system:
            organ_systems.append(organ_system)
    
    # Count occurrences
    category_counts = Counter(categories)
    organ_system_counts = Counter(organ_systems)
    
    print(f"\nTotal cases: {len(data)}")
    print(f"Unique categories: {len(category_counts)}")
    print(f"Unique organ systems: {len(organ_system_counts)}")
    
    # Sort by name for easier review
    sorted_categories = sorted(category_counts.items())
    sorted_organ_systems = sorted(organ_system_counts.items())
    
    # Save categories to file
    categories_file = script_dir / 'categories_list.txt'
    with open(categories_file, 'w', encoding='utf-8') as f:
        f.write("CATEGORIES (sorted alphabetically)\n")
        f.write("=" * 50 + "\n\n")
        for category, count in sorted_categories:
            f.write(f"{category} ({count} cases)\n")
    
    # Save organ systems to file
    organ_systems_file = script_dir / 'organ_systems_list.txt'
    with open(organ_systems_file, 'w', encoding='utf-8') as f:
        f.write("ORGAN SYSTEMS (sorted alphabetically)\n")
        f.write("=" * 50 + "\n\n")
        for organ_system, count in sorted_organ_systems:
            f.write(f"{organ_system} ({count} cases)\n")
    
    print(f"\nCategories saved to: {categories_file}")
    print(f"Organ systems saved to: {organ_systems_file}")
    
    # Print top categories and organ systems for quick review
    print("\nTOP 20 CATEGORIES:")
    print("-" * 30)
    for category, count in category_counts.most_common(20):
        print(f"{category}: {count}")
    
    print("\nTOP 20 ORGAN SYSTEMS:")
    print("-" * 30)
    for organ_system, count in organ_system_counts.most_common(20):
        print(f"{organ_system}: {count}")

if __name__ == "__main__":
    main()
