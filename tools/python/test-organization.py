#!/usr/bin/env python3
"""
Test script to verify that the reorganized directory structure works correctly.
"""

import os
import sys
from pathlib import Path

def test_directory_structure():
    """Test that all expected directories and files exist."""
    print("Testing directory structure...")
    
    # Expected directories
    expected_dirs = [
        'data',
        'data/content-specs',
        'data/content-specs/json',
        'data/content-specs/json/ap',
        'data/content-specs/json/cp',
        'data/question-specs',
        'data/reference',
        'tools',
        'tools/data-processing',
        'tools/scripts',
        'tools/database',
        'tests',
        'docs',
        'public'
    ]
    
    # Expected files
    expected_files = [
        'src/data/content_specifications_merged.json',
        'tools/README.md',
        'tools/data-processing/merge_json.py',
        'tools/data-processing/count_designations.py',
        'tools/data-processing/analyze_content_specs.py',
        'tests/README.md',
        'tests/auth.spec.ts',
        'docs/README.md',
        'public/README.md'
    ]
    
    # Check directories
    missing_dirs = []
    for dir_path in expected_dirs:
        if not Path(dir_path).exists():
            missing_dirs.append(dir_path)
    
    if missing_dirs:
        print(f"❌ Missing directories: {missing_dirs}")
        return False
    else:
        print(f"✅ All {len(expected_dirs)} expected directories exist")
    
    # Check files
    missing_files = []
    for file_path in expected_files:
        if not Path(file_path).exists():
            missing_files.append(file_path)
    
    if missing_files:
        print(f"❌ Missing files: {missing_files}")
        return False
    else:
        print(f"✅ All {len(expected_files)} expected files exist")
    
    return True

def test_json_structure():
    """Test that the JSON files are accessible and have correct structure."""
    print("\nTesting JSON file structure...")
    
    try:
        import json
        
        # Test merged content specifications
        with open('src/data/content_specifications_merged.json', 'r') as f:
            data = json.load(f)
        
        # Check structure
        if 'content_specifications' not in data:
            print("❌ Missing 'content_specifications' key in merged file")
            return False
        
        content_specs = data['content_specifications']
        
        if 'ap_sections' not in content_specs:
            print("❌ Missing 'ap_sections' in content specifications")
            return False
        
        if 'cp_sections' not in content_specs:
            print("❌ Missing 'cp_sections' in content specifications")
            return False
        
        ap_count = len(content_specs['ap_sections'])
        cp_count = len(content_specs['cp_sections'])
        
        print(f"✅ Content specifications loaded successfully")
        print(f"   - AP sections: {ap_count}")
        print(f"   - CP sections: {cp_count}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error loading JSON: {e}")
        return False

def test_script_imports():
    """Test that the reorganized scripts can be imported/executed."""
    print("\nTesting script accessibility...")
    
    scripts_to_test = [
        'tools/data-processing/merge_json.py',
        'tools/data-processing/count_designations.py'
    ]
    
    for script_path in scripts_to_test:
        try:
            # Check if script is executable
            if not os.access(script_path, os.R_OK):
                print(f"❌ Script not readable: {script_path}")
                return False
            
            # Check if script has proper shebang
            with open(script_path, 'r') as f:
                first_line = f.readline().strip()
                if not first_line.startswith('#!'):
                    print(f"❌ Script missing shebang: {script_path}")
                    return False
            
            print(f"✅ Script accessible: {script_path}")
            
        except Exception as e:
            print(f"❌ Error checking script {script_path}: {e}")
            return False
    
    return True

def main():
    """Run all tests."""
    print("🧹 Testing Pathology Bites Directory Organization")
    print("=" * 50)
    
    tests = [
        test_directory_structure,
        test_json_structure,
        test_script_imports
    ]
    
    all_passed = True
    
    for test in tests:
        if not test():
            all_passed = False
    
    print("\n" + "=" * 50)
    if all_passed:
        print("🎉 All tests passed! Directory organization is working correctly.")
    else:
        print("❌ Some tests failed. Please check the issues above.")
        sys.exit(1)

if __name__ == '__main__':
    main()
