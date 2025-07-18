#!/usr/bin/env python3
"""
Filter out cases with unknown/unclear diagnoses from the consolidated virtual slides data.

This script removes cases where the diagnosis is:
- Empty or blank
- "unknown" (case insensitive)
- "unclear" 
- "unspecified"
- Starts with question marks indicating uncertainty
- Other patterns indicating no clear diagnosis
"""

import json
import re
from pathlib import Path

def is_unknown_diagnosis(diagnosis):
    """
    Check if a diagnosis indicates an unknown case that should be filtered out.
    Only filters cases that are truly just "unknown" and nothing else.

    Args:
        diagnosis (str): The diagnosis string to check

    Returns:
        bool: True if the diagnosis should be filtered out, False otherwise
    """
    if not diagnosis or not diagnosis.strip():
        return True

    diagnosis_lower = diagnosis.lower().strip()

    # Only exact matches for truly unknown cases
    exact_unknown = [
        'unknown', 'unclear', 'n/a', 'na', 'none', 'blank', 'empty',
        'no diagnosis', 'pending', 'awaiting', 'tbd'
    ]

    # Only filter if it's exactly one of these terms
    if diagnosis_lower in exact_unknown:
        return True

    # Only filter if it's just question marks
    if re.match(r'^\?+\s*$', diagnosis_lower):
        return True

    return False

def is_non_human_case(case):
    """
    Check if a case is from a non-human species.

    Args:
        case (dict): The case data

    Returns:
        bool: True if the case should be filtered out (non-human), False otherwise
    """
    # Check source metadata for species information
    source_metadata = case.get('source_metadata', {})

    # Check for species field in source metadata
    species = source_metadata.get('species', '').lower()
    if species and species not in ['human', 'homo sapiens', '']:
        return True

    # Only check for explicit animal indicators in parentheses
    # This avoids filtering human diseases that happen to contain animal names
    diagnosis = case.get('diagnosis', '').lower()
    patient_info = case.get('patient_info', '').lower()
    clinical_history = case.get('clinical_history', '').lower()

    # Look for explicit animal species indicators in parentheses only
    animal_patterns = [
        r'\(canine\)', r'\(feline\)', r'\(bovine\)', r'\(equine\)',
        r'\(porcine\)', r'\(ovine\)', r'\(murine\)', r'\(rodent\)',
        r'\(dog\)', r'\(cat\)', r'\(cow\)', r'\(horse\)', r'\(pig\)',
        r'\(sheep\)', r'\(mouse\)', r'\(rat\)', r'\(rabbit\)',
        r'\(guinea pig\)', r'\(hamster\)', r'\(monkey\)', r'\(primate\)'
    ]

    # Check all text fields for animal indicators in parentheses
    all_text = f"{diagnosis} {patient_info} {clinical_history}".lower()

    for pattern in animal_patterns:
        if re.search(pattern, all_text):
            return True

    return False

def filter_cases(input_file, output_file):
    """
    Filter out cases with unknown diagnoses and non-human cases from the consolidated data.

    Args:
        input_file (Path): Path to the input consolidated JSON file
        output_file (Path): Path to save the filtered JSON file
    """
    # Load the consolidated data
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    print(f"Original dataset: {len(data)} cases")

    # Filter out unknown and non-human cases
    filtered_data = []
    unknown_filtered = []
    non_human_filtered = []

    for case in data:
        diagnosis = case.get('diagnosis', '')

        if is_unknown_diagnosis(diagnosis):
            unknown_filtered.append(case)
        elif is_non_human_case(case):
            non_human_filtered.append(case)
        else:
            filtered_data.append(case)

    # Save filtered data
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(filtered_data, f, indent=2, ensure_ascii=False)

    total_filtered = len(unknown_filtered) + len(non_human_filtered)

    print(f"Filtered dataset: {len(filtered_data)} cases")
    print(f"Removed unknown cases: {len(unknown_filtered)} cases")
    print(f"Removed non-human cases: {len(non_human_filtered)} cases")
    print(f"Total removed: {total_filtered} cases ({total_filtered/len(data)*100:.1f}%)")
    print(f"Filtered data saved to: {output_file}")

    # Print summary of what was filtered out
    from collections import Counter

    if unknown_filtered:
        unknown_diagnoses = [case.get('diagnosis', '') for case in unknown_filtered]
        unknown_counter = Counter(unknown_diagnoses)
        print("\nFiltered out unknown diagnosis patterns:")
        for diagnosis, count in unknown_counter.most_common(10):
            print(f"  \"{diagnosis}\" - {count} cases")

    if non_human_filtered:
        print(f"\nSample non-human cases filtered:")
        for i, case in enumerate(non_human_filtered[:5]):
            diagnosis = case.get('diagnosis', '')
            species_info = case.get('source_metadata', {}).get('species', 'detected from text')
            print(f"  {i+1}. \"{diagnosis}\" - {species_info}")

    return len(filtered_data), len(unknown_filtered), len(non_human_filtered)

def main():
    """Main function to filter unknown diagnoses and non-human cases."""
    base_path = Path(__file__).parent.parent
    input_file = base_path / 'virtual-slides-consolidated.json'
    output_file = base_path / 'virtual-slides-filtered.json'

    if not input_file.exists():
        print(f"Error: Input file not found: {input_file}")
        return

    print("Filtering out cases with unknown diagnoses and non-human cases...")
    print("="*60)

    filtered_count, unknown_count, non_human_count = filter_cases(input_file, output_file)

    print("="*60)
    print("Filtering complete!")
    print(f"✅ Kept: {filtered_count:,} cases with clear human diagnoses")
    print(f"❌ Removed unknown: {unknown_count:,} cases")
    print(f"❌ Removed non-human: {non_human_count:,} cases")

if __name__ == "__main__":
    main()
