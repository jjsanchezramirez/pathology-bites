# Question Specifications

This directory contains question specifications and distribution data for pathology question banks.

## 📁 Structure

```
question-specs/
├── ap/                                     # Anatomic Pathology questions
│   └── md/                                # Markdown format question specs
├── cp/                                     # Clinical Pathology questions
│   └── md/                                # Markdown format question specs
└── pathology_question_distribution.md     # Question distribution analysis
```

**Note:** JSON files have been moved to `src/data/question-specs/` for better organization.

## 📊 Content Types

### Question Formats
- **JSON** - Structured question data for application import
- **Markdown** - Human-readable question specifications

### Disciplines
- **AP (Anatomic Pathology)** - Tissue-based pathology questions
- **CP (Clinical Pathology)** - Laboratory medicine questions

## 📈 Distribution Analysis

The `pathology_question_distribution.md` file contains:
- Question count by section
- Distribution across difficulty levels
- Coverage analysis by content area
- Recommendations for question development

## 🎯 Purpose

This data supports:
- Question bank development
- Content gap analysis
- Educational planning
- Assessment design

## 🔄 Maintenance

- Update question specs as content is developed
- Maintain distribution analysis for balanced coverage
- Coordinate with content specifications for alignment
