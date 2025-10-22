# Semantic Scholar Citation Generator

This tool allows you to search for pathology review articles using the Semantic Scholar API and generate citations in multiple formats (APA, MLA, AMA, Vancouver).

## Features

- Search for pathology review articles by topic
- Automatic filtering for review articles
- Sort by citation count
- Display abstracts and open access PDFs
- Generate citations in 4 academic formats
- Copy citations to clipboard

## Usage

1. Navigate to `/tools/semantic-scholar-citations`
2. Enter a pathology topic (e.g., "Langerhans cell histiocytosis")
3. Click "Search Review Articles"
4. Select a paper from the results
5. View and copy citations in your preferred format

## API Key Setup (Optional but Recommended)

Semantic Scholar has rate limits for anonymous requests. For better performance and higher rate limits, you can get a free API key:

### How to Get an API Key

1. Visit https://www.semanticscholar.org/product/api#api-key-form
2. Fill out the form with your information
3. You'll receive an API key via email

### Adding the API Key to Your Project

Add the following to your `.env.local` file:

```bash
SEMANTIC_SCHOLAR_API_KEY=your_api_key_here
```

The application will automatically use the API key if it's available, which provides:
- Higher rate limits
- More reliable access
- Better performance

## Rate Limiting

Without an API key, you may encounter rate limiting errors (429 Too Many Requests). If this happens:
- Wait a few moments before trying again
- Consider adding an API key (see above)
- The error message will provide guidance

## Technical Details

### API Endpoint
- **Path**: `/api/public/tools/semantic-scholar/search`
- **Method**: GET
- **Parameters**:
  - `query` (required): Search term
  - `limit` (optional): Number of results (default: 10, max: 20)

### Search Strategy
The API automatically:
1. Adds "review pathology" to your search query
2. Filters results for review articles
3. Prioritizes papers with review publication types
4. Sorts by citation count (highest first)

### Citation Integration
The tool uses the existing citation formatters from `/src/shared/utils/citation-formatters.ts` to ensure consistency with the rest of the application.
