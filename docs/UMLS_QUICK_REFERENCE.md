# UMLS Integration - Quick Reference

## TL;DR

The diagnostic search now uses UMLS API to expand medical abbreviations and find synonyms, dramatically improving search coverage beyond the original 20 hardcoded abbreviations.

## Quick Setup (5 minutes)

1. Get free API key: https://uts.nlm.nih.gov/uts/signup-login
2. Add to `.env.local`: `UMLS_API_KEY=your_key`
3. Done! Works automatically with intelligent fallback.

## What Changed

### Before
```typescript
// Hardcoded 20 abbreviations
const ABBREVIATIONS = {
  'dlbcl': ['diffuse large b cell lymphoma'],
  'cll': ['chronic lymphocytic leukemia'],
  // ... only 20 total
}
```

### After
```typescript
// Dynamic UMLS lookup + static fallback
const expansions = await expandSearchTerm('DLBCL')
// Returns: ['dlbcl', 'diffuse large b-cell lymphoma', 'dlbcl nhl', ...]
// Covers 3.49+ million medical concepts
```

## Key Features

| Feature | Details |
|---------|---------|
| **Coverage** | 3.49M+ concepts (vs 20 hardcoded) |
| **Caching** | 7-day TTL, 1000 entry limit |
| **Performance** | First search: +500-1500ms, Cached: +0ms |
| **Fallback** | Works without API key (static list) |
| **Rate Limit** | Min 100ms between calls |
| **Timeout** | 5 seconds per request |

## Usage Examples

### Code
```typescript
import { expandSearchTerm } from './umls-expansion'

// Expands abbreviations and finds synonyms
const variants = await expandSearchTerm('DLBCL')
// Returns: ['dlbcl', 'diffuse large b cell lymphoma', ...]
```

### API Endpoints

**Check cache stats:**
```bash
curl http://localhost:3000/api/admin/umls-cache
```

**Clear cache:**
```bash
curl -X DELETE http://localhost:3000/api/admin/umls-cache
```

### Testing
```bash
# Test without UMLS (static fallback)
npx tsx scripts/test-umls-expansion.ts

# Test with UMLS
UMLS_API_KEY=your_key npx tsx scripts/test-umls-expansion.ts
```

## Files Created/Modified

**New Files:**
- `src/app/api/public/tools/diagnostic-search/umls-expansion.ts` - Core service
- `src/app/api/admin/umls-cache/route.ts` - Cache management
- `docs/UMLS_SETUP.md` - Detailed documentation
- `scripts/test-umls-expansion.ts` - Test script

**Modified:**
- `src/app/api/public/tools/diagnostic-search/simple-search-v2.ts` - Uses new expansion

## Environment Variables

```bash
# Optional - system works without it using static fallback
UMLS_API_KEY=your_key_here
```

## Monitoring

### Log Messages

```
[UMLS] Searching for: "DLBCL"
[UMLS] Found 3 expansions
[Expansion] Cached 4 hybrid terms for "DLBCL"
```

### Cache Stats Response
```json
{
  "total_entries": 42,
  "sources": {
    "umls": 30,
    "static": 5,
    "hybrid": 7
  },
  "umls_configured": true
}
```

## Performance

| Scenario | Latency | Cache Hit |
|----------|---------|-----------|
| First search (UMLS) | 500-1500ms | No |
| Cached search | <1ms | Yes |
| Static fallback | <1ms | N/A |

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `umls_configured: false` | Add `UMLS_API_KEY` to environment |
| Slow searches | Normal for first search, caches for 7 days |
| No expansions | Check API key validity at UTS portal |

## Cost & Limits

- **UMLS API**: FREE (no charge)
- **Rate limit**: Self-imposed 100ms (no official limit)
- **Storage**: ~100KB for 1000 cached entries
- **Bandwidth**: ~1KB per UMLS API call

## Next Steps

1. ✅ Get UMLS API key
2. ✅ Add to environment
3. ✅ Test with `npx tsx scripts/test-umls-expansion.ts`
4. ✅ Deploy and monitor cache stats
5. 🔄 Optional: Adjust cache TTL or size limits

## Links

- [Setup Guide](./UMLS_SETUP.md)
- [UMLS Portal](https://uts.nlm.nih.gov/)
- [API Docs](https://documentation.uts.nlm.nih.gov/)
