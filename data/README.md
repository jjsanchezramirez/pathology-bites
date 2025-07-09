# Data Directory

This directory contains all data files for the Pathology Bites application, organized by type and purpose.

## Directory Structure

```
data/
├── content-specs/                    # Content specification data
│   ├── json/                        # Individual JSON files by section
│   │   ├── ap/                      # Anatomic Pathology sections
│   │   │   ├── 1_breast.json
│   │   │   ├── 2_genitourinary.json
│   │   │   ├── 3_muscle.json
│   │   │   ├── 4_cardiovascular.json
│   │   │   ├── 5_bone_joint.json
│   │   │   ├── 6_digestive_system.json
│   │   │   ├── 7_endocrine_system.json
│   │   │   ├── 8_head_neck.json
│   │   │   ├── 9_placenta.json
│   │   │   ├── 10_respiratory.json
│   │   │   ├── 11_skin.json
│   │   │   ├── 12_cytopathology.json
│   │   │   ├── 13_dermatopathology.json
│   │   │   ├── 14_forensic_pathology.json
│   │   │   ├── 15_hematopathology.json
│   │   │   ├── 16_neuropathology.json
│   │   │   └── 17_pediatric_pathology.json
│   │   └── cp/                      # Clinical Pathology sections
│   │       ├── 1_blood_banking.json
│   │       ├── 2_chemical_pathology.json
│   │       ├── 3_hematopathology.json
│   │       ├── 4_medical_microbiology.json
│   │       └── 5_molecular_pathology.json
│   └── content_specifications_merged.json  # Consolidated file
└── README.md                        # This file
```

## Content Specifications

### Individual JSON Files
Each JSON file represents a section of the pathology content specifications:

- **Anatomic Pathology (AP)**: 17 sections covering different organ systems and specialties
- **Clinical Pathology (CP)**: 5 sections covering laboratory medicine areas

### File Format
Each JSON file contains structured pathology content with:
- **Section metadata**: Title, type (AP/CP), section number
- **Items**: Individual content items with designations (C, AR, F)
- **Subsections**: Organized groupings of related content
- **Hierarchical structure**: Nested items and subitems

### Designations
- **C**: Core content (required for all residents)
- **AR**: Advanced Resident content (for senior residents)
- **F**: Fellow content (subspecialty fellowship level)

### Merged File
`content_specifications_merged.json` contains all individual files combined into a single structure for easier processing and application use.

## Data Integrity

### Line Numbers
Each item includes line numbers that correspond to the original source documents for traceability.

### Validation
Data is validated using scripts in the `tools/validation/` directory to ensure:
- Consistent structure across files
- Valid line number sequences
- Proper designation assignments
- Complete hierarchical relationships

## Usage in Application

### Public Access
The merged JSON file is copied to the `public/` directory for web application access via HTTP requests.

### API Integration
The application loads content specifications from `/content_specifications_merged.json` endpoint.

### Processing Pipeline
1. Individual JSON files are maintained for easier editing and version control
2. Merge script combines files into consolidated format
3. Validation ensures data integrity
4. Merged file is deployed for application use

## Maintenance

### Adding New Content
1. Edit appropriate individual JSON file in `json/ap/` or `json/cp/`
2. Run merge script: `python tools/data-processing/merge_json.py`
3. Validate: `python tools/validation/validate_line_numbers.py`
4. Copy merged file to public directory if needed

### Updating Existing Content
1. Modify individual JSON files
2. Follow same merge and validation process
3. Test in application to ensure proper display

### Data Backup
- Individual JSON files serve as source of truth
- Version control provides change history
- Merged file can be regenerated from individual files

## File Sizes and Statistics

The content specifications contain approximately:
- **Total sections**: 22 (17 AP + 5 CP)
- **Total items**: ~1,250 designated items
- **File sizes**: Range from ~400 lines to ~6,000 lines per section
- **Designations**: Mix of C, AR, and F level content

## Future Enhancements

### Pathology Outlines
The `pathology-outlines/` directory is reserved for future integration of pathology outline data that may complement the content specifications.

### Additional Data Types
Future data types may include:
- Question banks
- Image collections
- Reference materials
- Study guides
