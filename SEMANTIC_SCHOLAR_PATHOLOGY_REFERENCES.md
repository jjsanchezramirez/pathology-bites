# Semantic Scholar API - Pathology-Focused Reference Fetching

## Overview

The reference fetching system now uses advanced Semantic Scholar API filters to provide **high-quality, pathology-specific** references.

## Current Implementation

### API Filters Applied

1. **Search Query Enhancement**
   - Automatically adds "pathology" to all searches
   - Example: "melanoma diagnosis" → "melanoma diagnosis pathology"

2. **Field of Study Filtering**
   - `fieldsOfStudy: Medicine,Biology`
   - Focuses on medical and biological sciences
   - Excludes computer science, physics, etc.

3. **Quality Filters**
   - **Year**: 2010 onwards (last 15 years)
   - **Minimum Citations**: 5+ citations
   - Ensures papers have academic impact

4. **Citation Count**: Added to sort by influence

### Pathology Journal Prioritization

The system prioritizes references from these sources:

**Top-Tier Pathology Journals:**
- American Journal of Surgical Pathology
- Modern Pathology
- Journal of Pathology
- Histopathology
- Archives of Pathology & Laboratory Medicine
- Human Pathology
- American Journal of Clinical Pathology
- Diagnostic Pathology
- Virchows Archiv
- Journal of Clinical Pathology

**High-Impact Medical Journals** (pathology content):
- New England Journal of Medicine
- The Lancet
- JAMA
- Nature Medicine
- Blood
- Clinical Cancer Research
- Cell, Science, Nature

### Sorting Algorithm

References are sorted by:
1. **Pathology journals first** (from the curated list above)
2. **Then by citation count** (higher = more influential)

## Semantic Scholar API Capabilities

### Available Parameters

The Semantic Scholar API supports many filters. Here are the most relevant for pathology:

#### 1. Fields of Study
```
fieldsOfStudy: Medicine,Biology,Chemistry
```
Available fields: Medicine, Biology, Chemistry, Psychology, Computer Science, etc.

#### 2. Year Range
```
year: 2010-2024    # Specific range
year: 2015-        # 2015 onwards
year: -2020        # Before 2020
```

#### 3. Citation Filters
```
minCitationCount: 5     # Minimum citations
maxCitationCount: 1000  # Maximum citations
```

#### 4. Venue/Journal (NOT currently available in search API)
Unfortunately, the search API doesn't support direct venue filtering. We work around this by:
- Getting more results (10 instead of 5)
- Sorting by pathology journal match
- Taking top 3 after sorting

#### 5. Open Access
```
openAccessPdf: true  # Only papers with free PDFs
```

#### 6. Publication Type
```
publicationTypes: JournalArticle,Review
```
Types: JournalArticle, Review, Conference, Book, Patent, etc.

### Advanced Query Syntax

The `query` parameter supports boolean operators:

```
"melanoma diagnosis" AND pathology         # All terms required
"breast cancer" OR "mammary carcinoma"     # Either term
"lymphoma" NOT "Hodgkin"                   # Exclude terms
"immunohistochemistry"~5                   # Fuzzy matching
```

## Recommendations for Further Improvement

### Option 1: Add Review Filter
Prefer review articles for educational content:
```typescript
semanticScholarUrl.searchParams.append('publicationTypes', 'Review,JournalArticle')
```

### Option 2: Adjust Year Range
Make it configurable (5, 10, 15 years):
```typescript
const yearRange = '2015-' // Last 10 years
semanticScholarUrl.searchParams.append('year', yearRange)
```

### Option 3: Increase Citation Threshold
For more authoritative sources:
```typescript
semanticScholarUrl.searchParams.append('minCitationCount', '10')
```

### Option 4: Add Open Access Filter
For papers with accessible PDFs:
```typescript
semanticScholarUrl.searchParams.append('openAccessPdf', 'true')
```

### Option 5: Multi-Query Strategy
For very specific topics, could try multiple queries:
1. First try: "topic + pathology" in Medicine field
2. If <3 results: Broaden to "topic" in Medicine,Biology
3. Fallback: General medical journals

## API Rate Limits

- **Without API Key**: 1 request/second, 100/5 minutes
- **With API Key**: 10 requests/second, higher limits

Current implementation:
- Enforces 1.1 second delay between requests
- 24-hour caching to reduce API calls
- Retry logic for rate limit errors

## Getting an API Key (Optional)

1. Sign up at: https://www.semanticscholar.org/product/api
2. Request API key (free for academic/educational use)
3. Add to environment: `SEMANTIC_SCHOLAR_API_KEY=your_key`
4. Benefits:
   - 10x rate limit increase
   - Priority processing
   - Access to beta features

## Testing

Test the endpoint:
```bash
curl -X POST http://localhost:3000/api/admin/fetch-references \
  -H "Content-Type: application/json" \
  -d '{"searchTerms": "melanoma immunohistochemistry"}'
```

Expected response:
```json
{
  "success": true,
  "references": [
    "Author A, Author B (2020). Title here. Modern Pathology.",
    "Author C, Author D (2019). Another title. American Journal of Surgical Pathology.",
    "Author E (2021). Third title. Journal of Pathology."
  ],
  "cached": false
}
```

## Related Documentation

- Semantic Scholar API Docs: https://api.semanticscholar.org/api-docs/
- Field of Study List: https://api.semanticscholar.org/api-docs/graph#tag/Paper-Data/operation/get_graph_get_paper_search
- Query Syntax: Uses Elasticsearch query syntax
