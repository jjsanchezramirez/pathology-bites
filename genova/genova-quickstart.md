# Genova Quick Start Guide

## What It Does

Automatically classifies genomic variants using clinical databases and computational predictors, following AMP/ASCO/CAP 2017 guidelines.

**Input:** Free-text variant description
**Output:** Tiered classification with evidence summary

---

## Quick Example

```bash
POST /api/public/genomic/classify
{
  "rawText": "BRAF V600E VAF: 25.3"
}
```

**Response:**
```json
{
  "classification": {
    "classification": "Pathogenic",
    "tier": "Tier I (Level A)",
    "shouldReport": true,
    "reasoning": "FDA-approved therapy (OncoKB LEVEL_1)..."
  }
}
```

---

## File Structure

```
src/shared/utils/genomic/
├── types.ts              # TypeScript interfaces
├── parsing.ts            # Extract gene, VAF, coordinates from text
├── clinvar.ts            # Normalize ClinVar data + conflict detection
├── data-fetching.ts      # Fetch from MyVariant.info & OncoKB
├── classification.ts     # AMP/ASCO/CAP tiered classification
└── index.ts              # Exports

src/app/api/public/genomic/classify/
└── route.ts              # API endpoint (74 lines)
```

---

## Supported Input Formats

### Minimal
```
"BRAF V600E"
"TP53 R273H"
"EGFR L858R"
```

### With VAF
```
"BRAF V600E VAF: 25.3"
"NF1 Q2288* VAF 92"
```

### With Coordinates
```
"BRAF V600E (c.1799T>A) chr7:g.140453136A>T"
"17:29665764:C:T"  // VCF format
```

### Complete
```
"BRAF V600E (c.1799T>A) chr7:g.140453136A>T NM_004333.4 rs113488022 VAF: 25.3"
```

---

## Classification Tiers

| Tier | Meaning | Report? | Examples |
|------|---------|---------|----------|
| **Tier I** | Strong Clinical Significance | ✓ | FDA-approved therapy, ClinVar pathogenic + COSMIC >100 |
| **Tier II** | Potential Significance | ✓* | Clinical trial evidence, single strong source |
| **Tier III** | VUS (Uncertain) | ✗ | Conflicting evidence, borderline predictors |
| **Tier IV** | Benign | ✗ | ClinVar benign, common polymorphism |

*Tier II Level D may not be reported if only biological evidence

---

## Data Sources

### Clinical Databases
- **ClinVar:** Germline + somatic pathogenicity
- **OncoKB:** Oncogenic classification + FDA therapy levels
- **COSMIC:** Somatic mutation frequency
- **gnomAD:** Population frequency

### Computational Predictors (5 core)
1. **REVEL** (best single predictor): >0.75 pathogenic, <0.4 benign
2. **CADD**: >20 pathogenic, <10 benign
3. **GERP**: >4 conserved, <2 not conserved
4. **SIFT**: D = deleterious, T = tolerated
5. **PolyPhen2**: D = damaging, B = benign

---

## Special Features

### 1. Stop Codon Handling
**Problem:** MyVariant.info stores `Q2288*` as `Q2288X` or `Q2288Ter`
**Solution:** Automatic conversion in query

```typescript
Input:  "NF1 Q2288*"
Query:  "dbnsfp.genename:NF1 AND (dbnsfp.hgvsp:*Q2288X* OR dbnsfp.hgvsp:*Q2288Ter*)"
```

### 2. Conflicting ClinVar Resolution
**When ClinVar shows conflicts** (e.g., Pathogenic vs Benign):
- ClinVar is **excluded** from classification
- Falls back to computational predictors
- Conflict is **shown** in evidence for transparency

**Example:**
```
ClinVar: Conflicting (2 Pathogenic, 1 Benign)
Classification: Likely Benign (4/5 computational predictors benign)
```

### 3. Strong Benign Classification
**Two scenarios** where strong benign evidence overrides VUS:

**A. Conflicting ClinVar + Strong Benign Evidence**
```
Required:
- ClinVar conflicting
- 3+ benign predictors > pathogenic predictors
OR
- 4+ benign predictors + REVEL <0.3
```

**B. No Clinical Database + Strong Benign Evidence**
```
Required:
- No ClinVar, OncoKB "Unknown", COSMIC = 0
- 4+ benign predictors
- REVEL <0.3
- Benign predictors ≥ 3× pathogenic predictors
```

---

## Common Use Cases

### Case 1: Known Driver Mutation
```
Input:  "BRAF V600E"
Result: Pathogenic (Tier I) - FDA-approved therapy
Drugs:  Vemurafenib, Dabrafenib, Trametinib
```

### Case 2: Germline Polymorphism
```
Input:  "ATM T2396S VAF: 50"
Result: Likely Benign - VAF ~50% with population frequency
```

### Case 3: VUS with Strong Computational Evidence
```
Input:  "Novel missense variant REVEL 0.82"
Result: VUS (Strong Computational Evidence) - Reportable due to high REVEL
```

### Case 4: Common Variant
```
Input:  "Variant with gnomAD AF 6%"
Result: Benign (BA1) - Stand-alone benign (common in population)
```

---

## Algorithm Flow

```
1. Parse Text
   ↓
2. Fetch MyVariant.info (Gene+Protein → Genomic → rsID)
   ↓
3. Fetch OncoKB (if API key available)
   ↓
4. Filter Technical Artifacts (VAF <5%, 3'UTR, homopolymers)
   ↓
5. Filter Population Frequency (gnomAD >5% → Benign)
   ↓
6. Classify by Tier (I → II → III → IV)
   ↓
7. Return Classification + Evidence
```

---

## Testing

Run all test cases:
```bash
# Test 1: Stop codon
curl -X POST http://localhost:3000/api/public/genomic/classify \
  -H "Content-Type: application/json" \
  -d '{"rawText": "NF1 Q2288* VAF 92"}'

# Test 2: Conflicting ClinVar
curl -X POST http://localhost:3000/api/public/genomic/classify \
  -H "Content-Type: application/json" \
  -d '{"rawText": "ATM T2396S VAF 42"}'

# Test 3: Known oncogenic
curl -X POST http://localhost:3000/api/public/genomic/classify \
  -H "Content-Type: application/json" \
  -d '{"rawText": "BRAF V600E VAF: 25.3"}'
```

---

## Environment Setup

### Required
None - MyVariant.info is public

### Optional
```bash
ONCOKB_API_KEY=your_key_here  # For therapeutic implications
```

Get OncoKB API key: https://www.oncokb.org/api/

---

## Troubleshooting

### "Could not extract sufficient variant identifiers"
**Problem:** Text doesn't contain recognizable gene/variant
**Solution:** Include at minimum: `GENE MUTATION` (e.g., "BRAF V600E")

### No MyVariant.info data found
**Problem:** Variant not in database
**Solution:** Classification will use OncoKB only (if available) or return VUS

### OncoKB returns null
**Problem:** No API key or variant not in OncoKB
**Solution:** Classification continues with MyVariant.info data only

### Classification is "VUS" but you expected pathogenic
**Possible reasons:**
1. ClinVar is conflicting (excluded from classification)
2. No clinical database evidence
3. Computational predictors are borderline (REVEL 0.4-0.75)

---

## Performance

| Step | Time | Notes |
|------|------|-------|
| Parsing | <1ms | Fast regex |
| MyVariant.info | 200-800ms | External API |
| OncoKB | 300-1200ms | External API (optional) |
| Classification | <5ms | Pure computation |
| **Total** | **500-2000ms** | API latency dominant |

---

## Import & Use in Code

```typescript
import {
  parseVariantText,
  fetchVariantData,
  classifyVariant,
  type ParsedVariant,
  type ClassificationResult
} from '@/shared/utils/genomic';

// Example usage
const parsed = parseVariantText("BRAF V600E");
const data = await fetchVariantData(parsed);
const classification = classifyVariant(parsed, variantType, data, oncokb, artifact);
```

---

## Next Steps

- Read full algorithm documentation: `docs/genomic-analysis-algorithm.md`
- Review AMP/ASCO/CAP guidelines: Li MM, et al. *J Mol Diagn* 2017
- Explore MyVariant.info API: https://myvariant.info/v1/api/
- Review OncoKB levels: https://www.oncokb.org/levels

---

## Support

For issues or questions:
- GitHub Issues: [Report a bug](https://github.com/your-repo/issues)
- Documentation: See `docs/genomic-analysis-algorithm.md`
