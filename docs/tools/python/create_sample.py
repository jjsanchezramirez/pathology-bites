#!/usr/bin/env python3
"""
Create a sample of virtual slides data for development
"""

import json

def main():
    # Load the full unified data
    with open('src/data/virtual-slides-unified.json', 'r', encoding='utf-8') as f:
        full_data = json.load(f)
    
    # Take first 100 slides for development
    sample_data = full_data[:100]
    
    # Write sample data
    with open('src/data/virtual-slides-sample.json', 'w', encoding='utf-8') as f:
        json.dump(sample_data, f, indent=2, ensure_ascii=False)
    
    print(f"Created sample with {len(sample_data)} slides")
    
    # Print some stats
    repositories = {}
    for slide in sample_data:
        repo = slide.get('repository', 'Unknown')
        repositories[repo] = repositories.get(repo, 0) + 1
    
    print("Sample repositories:")
    for repo, count in repositories.items():
        print(f"  {repo}: {count}")

if __name__ == "__main__":
    main()
