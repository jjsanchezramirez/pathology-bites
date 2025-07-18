# Tools Directory

This directory contains utility scripts and tools for processing and validating pathology content data.

## Directory Structure

```
tools/
├── python/             # Python scripts for data processing and analysis
├── javascript/         # JavaScript tools and utilities
├── sql/               # Database migrations and SQL scripts
├── shell/             # Shell scripts for automation
├── json/              # JSON data files and reference lists
└── README.md          # This file
```

## Data Processing Scripts (`data-processing/`)

### `merge_json.py`
Merges individual JSON files from the content specifications into a single consolidated file.
- **Input**: Individual JSON files in `src/data/question-specs/` directory
- **Output**: `src/data/content_specifications_merged.json`
- **Usage**: `python tools/data-processing/merge_json.py`

### `analyze_content_specs.py`
Analyzes the content specifications to provide statistics and insights.
- **Input**: Merged content specifications JSON file
- **Output**: Analysis report with statistics
- **Usage**: `python tools/data-processing/analyze_content_specs.py`

### `analyze_json_structure.py`
Analyzes the structure of JSON files to understand data organization.
- **Input**: JSON files
- **Output**: Structure analysis report
- **Usage**: `python tools/data-processing/analyze_json_structure.py`

### `count_designations.py`
Counts the number of items with different designations (C, AR, F) across the content.
- **Input**: Content specifications JSON files
- **Output**: Designation count statistics
- **Usage**: `python tools/data-processing/count_designations.py`

### `analyze-cells.js`
Analyzes cell images and generates cell data for the application.
- **Input**: Cell images in `public/images/cells/`
- **Output**: Cell data JSON file for application use
- **Usage**: `node tools/data-processing/analyze-cells.js`

## Development Scripts (`scripts/`)

### `setup-dev.sh`
Sets up the development environment with necessary dependencies and configurations.
- **Purpose**: Automate development environment setup
- **Usage**: `bash tools/scripts/setup-dev.sh`

### `demo-questions.js`
Manages demo questions for the application.
- **Purpose**: Create, update, or manage demo question data
- **Usage**: `node tools/scripts/demo-questions.js`

### `apply-security-fixes.js`
Applies security fixes and updates to the application.
- **Purpose**: Automate security patch application
- **Usage**: `node tools/scripts/apply-security-fixes.js`

### `test-admin-components.sh`
Tests admin components functionality.
- **Purpose**: Automated testing of admin interface components
- **Usage**: `bash tools/scripts/test-admin-components.sh`

### `pathoutlines-scraper.js` / `pathoutlines_scraper.py`
Web scrapers for pathology outline data.
- **Purpose**: Extract pathology outline data from external sources
- **Usage**: `node tools/scripts/pathoutlines-scraper.js` or `python tools/scripts/pathoutlines_scraper.py`

### `test-organization.py`
Tests the directory organization structure.
- **Purpose**: Verify that directory reorganization is working correctly
- **Usage**: `python tools/scripts/test-organization.py`

## Database Scripts (`database/`)

### Migrations (`database/migrations/`)
Database schema migrations for version control and updates.
- **Purpose**: Manage database schema changes over time
- **Files**: Numbered migration files (01-*, 02-*, etc.)
- **Usage**: Apply migrations through your database management system

### Security Fixes (`database/security-fixes/`)
Database security patches and fixes.
- **Purpose**: Apply security-related database changes
- **Files**: Security-specific SQL scripts
- **Usage**: Apply through database management system with appropriate permissions

## Data Directory Structure

```
data/                        # Active data files used by application
├── cell-data.json          # Cell quiz data
├── blood_cells_reference.json  # Blood cell reference data
├── content_specifications_merged.json  # Consolidated content specifications
├── nlm_journal_abbreviations.json  # Journal abbreviations
└── virtual-slides-standardized-categories.json  # Virtual slides data

docs/json/                   # Archived and reference data
├── question-specs/          # Question specification data
│   ├── ap/                 # Anatomic Pathology sections
│   └── cp/                 # Clinical Pathology sections
└── virtual-slides-clean-subcategory.json  # Intermediate virtual slides data
```

## Usage Notes

1. **Python Environment**: These scripts require Python 3.6+ with standard libraries
2. **File Paths**: Scripts assume they are run from the project root directory
3. **Dependencies**: Most scripts use only standard Python libraries (json, os, sys, etc.)
4. **Data Flow**: Typically run `merge_json.py` first, then other analysis/validation scripts

## Common Workflows

### Data Processing Workflow
1. Update individual JSON files in `src/data/question-specs/`
2. Run `python tools/data-processing/merge_json.py` to create merged file
3. Run `python tools/data-processing/count_designations.py` for statistics
4. Run `python tools/data-processing/analyze_content_specs.py` for analysis

### Analysis Workflow
1. Run `python tools/data-processing/analyze_content_specs.py` for content analysis
2. Run `python tools/data-processing/analyze_json_structure.py` for structure analysis
3. Review outputs for insights and potential improvements

## Maintenance

- Keep this README updated when adding new scripts
- Document any new dependencies or requirements
- Update usage examples when script interfaces change
