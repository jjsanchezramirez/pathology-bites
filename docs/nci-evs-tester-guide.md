# NCI EVS API Tester Guide

## Overview

The NCI EVS (National Cancer Institute Enterprise Vocabulary Services) Tester is a development tool integrated into the Diagnostic Search page (`/tools/diagnostic-search`) that allows you to test and explore the NCI Thesaurus API.

## Location

Navigate to: **`/tools/diagnostic-search`**

The tester appears as a collapsible card at the top of the page with a dashed border and "🧪 NCI EVS API Tester" title.

## Features

### 1. **Search NCI Thesaurus**
- Enter any medical term (e.g., "melanoma", "carcinoma", "DCIS")
- Click "Search" to query the NCI EVS API
- Returns up to 10 results

### 2. **View Comprehensive Results**
Each result displays:
- **Concept Name**: Official NCI Thesaurus term
- **Code**: Unique NCI concept code (e.g., C3224)
- **Terminology**: Source terminology (typically "ncit")
- **Definition**: Official NCI definition
- **Synonyms**: Alternative names and abbreviations (shows first 5, with count of additional)

### 3. **Performance Metrics**
- **Total Results**: Number of concepts found
- **Response Time**: API response time in milliseconds

## API Details

### Endpoint
```
https://api-evsrest.nci.nih.gov/api/v1/concept/ncit/search
```

### Parameters Used
- `term`: Search query
- `include`: synonyms, definitions, properties
- `pageSize`: 10 (configurable)

### Response Format
```typescript
{
  concepts: [
    {
      code: string
      name: string
      terminology: string
      version: string
      synonyms: Array<{ name: string, type: string, source?: string }>
      definitions: Array<{ definition: string, source?: string }>
      properties: Array<{ type: string, value: string }>
    }
  ],
  total: number
}
```

## Example Searches

### 1. **Specific Diagnosis**
- Search: `ductal carcinoma`
- Returns: Various ductal carcinoma concepts with synonyms like "IDC", "invasive ductal carcinoma"

### 2. **Abbreviation**
- Search: `DCIS`
- Returns: "Ductal Carcinoma in Situ" with full definition and synonyms

### 3. **General Term**
- Search: `melanoma`
- Returns: Multiple melanoma subtypes and related concepts

### 4. **Organ-Specific**
- Search: `renal cell carcinoma`
- Returns: RCC concepts with synonyms like "kidney cancer", "hypernephroma"

## Use Cases

### 1. **Synonym Discovery**
Find alternative names and abbreviations for diagnostic entities to improve search matching.

### 2. **Definition Verification**
Verify official NCI definitions for pathology terms.

### 3. **Concept Code Lookup**
Get NCI concept codes for standardized terminology mapping.

### 4. **API Performance Testing**
Test NCI EVS API response times and availability.

### 5. **Search Algorithm Development**
Use results to inform synonym mappings and search improvements for the main diagnostic search.

## Integration Opportunities

### Potential Enhancements
1. **Auto-expand synonyms**: Use NCI EVS synonyms to enhance local search
2. **Fallback search**: If local search fails, query NCI EVS
3. **Synonym enrichment**: Periodically update local synonym mappings from NCI EVS
4. **Concept linking**: Link diagnostic search results to NCI concept codes

## Technical Notes

- **No API Key Required**: NCI EVS REST API is publicly accessible
- **Rate Limits**: Check NCI EVS documentation for current rate limits
- **CORS**: API supports CORS for client-side requests
- **Caching**: Consider implementing client-side caching for repeated queries

## Troubleshooting

### No Results
- Check spelling
- Try broader terms
- Use standard medical terminology
- Try abbreviations

### API Errors
- Check network connectivity
- Verify NCI EVS API status
- Check browser console for detailed error messages

### Slow Response
- NCI EVS API response times vary (typically 200-1000ms)
- Network latency may affect performance
- Consider implementing timeout handling

## Resources

- **NCI EVS REST API Documentation**: https://api-evsrest.nci.nih.gov/
- **NCI Thesaurus Browser**: https://ncit.nci.nih.gov/ncitbrowser/
- **API Swagger UI**: https://api-evsrest.nci.nih.gov/swagger-ui/index.html

## Development Notes

### Component Location
`src/shared/components/features/nci-evs-tester.tsx`

### Key Features
- Collapsible UI (starts collapsed)
- Real-time search
- Error handling
- Performance metrics
- Responsive design
- Scrollable results (max 600px height)

### Customization
To modify the component:
1. Adjust `pageSize` parameter for more/fewer results
2. Add additional `include` parameters (e.g., "parents", "children", "roles")
3. Customize result display fields
4. Add export functionality for results

