# Genomic Variant Analysis Algorithm

## Overview

The Genomic Variant Analysis tool is a comprehensive variant classification system that implements the **AMP/ASCO/CAP 2017 guidelines** for somatic variant interpretation in cancer. The system integrates multiple clinical databases (ClinVar, OncoKB, COSMIC) with computational predictors (REVEL, CADD, GERP, SIFT, PolyPhen2) to provide evidence-based variant classifications.

**Key Features:**

- Multi-strategy variant identification (gene+protein, genomic coordinates, rsID)
- Clinical database integration (ClinVar, OncoKB, COSMIC, gnomAD)
- Computational predictor analysis (5 core predictors)
- Tiered classification system (Tier I-IV)
- Conflict detection and resolution for contradictory evidence
- Technical artifact filtering
- Population frequency filtering

---

## Architecture

The system is organized into modular components for maintainability and reusability:

```
src/shared/utils/genomic/
├── index.ts                  # Centralized exports
├── types.ts                  # TypeScript interfaces (78 lines)
├── parsing.ts                # Variant text parsing (128 lines)
├── clinvar.ts                # ClinVar normalization (93 lines)
├── data-fetching.ts          # API clients (339 lines)
└── classification.ts         # Classification logic (595 lines)

src/app/api/public/genomic/classify/
└── route.ts                  # API endpoint (74 lines)
```

**Total Lines of Code:** ~1,307 lines (down from 1,170 in a single file)

---

## Module Documentation

### 1. Types (`types.ts`)

**Purpose:** Defines all TypeScript interfaces used across the genomic analysis system.

**Key Interfaces:**

#### ParsedVariant

```typescript
interface ParsedVariant {
  gene: string | null; // Gene symbol (e.g., "BRAF")
  hgvs_g: string | null; // Genomic notation (e.g., "chr7:g.140453136A>T")
  hgvs_c: string | null; // Coding notation (e.g., "c.1799T>A")
  hgvs_p: string | null; // Protein notation (e.g., "p.V600E")
  transcript: string | null; // RefSeq ID (e.g., "NM_004333.4")
  vaf: number | null; // Variant allele frequency (0-100)
  isComplex: boolean; // True for indels/duplications
  rsid?: string | null; // dbSNP ID (e.g., "rs113488022")
}
```

#### VariantData

```typescript
interface VariantData {
  found: boolean; // Successfully retrieved from MyVariant.info
  gnomadAF: number | null; // Population frequency (0.0-1.0)
  cosmicCount: number; // Number of COSMIC occurrences
  clinvarSignificance: string | null; // Normalized ClinVar classification

  // Computational predictors (5 core predictors)
  revel: number | null; // 0.0-1.0 (>0.75 = pathogenic, <0.4 = benign)
  cadd: number | null; // Phred score (>20 = pathogenic, <10 = benign)
  gerp: number | null; // Conservation score (>4 = pathogenic, <2 = benign)
  sift: string | null; // "D" = deleterious, "T" = tolerated
  polyphen2: string | null; // "D" = damaging, "B" = benign
}
```

#### ClassificationResult

```typescript
interface ClassificationResult {
  classification: string; // e.g., "Pathogenic", "Likely Benign", "VUS"
  tier: string; // AMP tier: "Tier I", "Tier II", "Tier III", "Tier IV"
  shouldReport: boolean; // Reportable to clinicians
  reasoning: string; // Human-readable explanation
  evidence: {
    clinicalDatabases: string[];
    computationalPredictors: Array<{
      name: string;
      value: string | number;
      interpretation: "Pathogenic" | "Benign" | "Uncertain";
    }>;
    populationFrequency: string;
  };
}
```

---

### 2. Parsing (`parsing.ts`)

**Purpose:** Extracts structured genomic identifiers from free-text variant descriptions.

**Function:** `parseVariantText(text: string): ParsedVariant`

**Capabilities:**

1. **Gene Symbol Extraction**
   - Pattern: `\b([A-Z][A-Z0-9]{1,10})\b`
   - Examples: BRAF, TP53, EGFR, NF1

2. **Genomic Coordinates**
   - VCF format: `17:29665764:C:T` → `chr17:g.29665764C>T`
   - HGVS format: `chr7:g.140453136A>T`

3. **Coding Notation**
   - With prefix: `c.1799T>A`
   - Bare notation: `185delAG` → `c.185delAG`
   - Complex variants: `c.2235_2249del15`

4. **Protein Notation**
   - Long form: `p.Val600Glu`
   - Short form: `V600E` → `p.V600E`
   - Stop codons: `Q2288*` → `p.Q2288*`
   - Frameshifts: `E746fs`

5. **Special Handling**
   - Stop codons: Recognizes `*` notation (e.g., `Q1329*`)
   - Transcript IDs: Avoids false positives near `NM_`, `NP_`, `ENST`
   - VAF extraction: `VAF: 25.3` or `VAF 25.3%`

**Example:**

```typescript
Input:  "BRAF V600E (c.1799T>A) chr7:g.140453136A>T NM_004333.4 rs113488022 VAF: 25.3"
Output: {
  gene: "BRAF",
  hgvs_g: "chr7:g.140453136A>T",
  hgvs_c: "c.1799T>A",
  hgvs_p: "p.V600E",
  transcript: "NM_004333.4",
  vaf: 25.3,
  rsid: "rs113488022",
  isComplex: false
}
```

---

### 3. ClinVar Normalization (`clinvar.ts`)

**Purpose:** Normalizes ClinVar clinical significance values and detects conflicting interpretations.

**Function:** `normalizeClinvarSignificance(clinicalSignificance: unknown): string | null`

**Input Handling:**

1. **String:** Direct normalization
2. **Array:** Multiple ClinVar submissions (e.g., `['Pathogenic', 'Likely pathogenic', 'Pathogenic']`)
3. **Object:** Extracts from `{ description: "..." }` format

**Conflict Detection Logic:**

```typescript
Pathogenic vs Benign        → "Conflicting"  // Major conflict
Likely Pathogenic vs Benign → "Conflicting"  // Major conflict
VUS vs Benign              → "Conflicting"  // Minor conflict
VUS vs Pathogenic          → "Conflicting"  // Minor conflict
```

**Priority Order (No Conflict):**

1. Pathogenic
2. Likely Pathogenic
3. Uncertain Significance
4. Likely Benign
5. Benign
6. Conflicting

**Examples:**

| Input                                        | Output          | Reason                   |
| -------------------------------------------- | --------------- | ------------------------ |
| `['Pathogenic', 'Pathogenic', 'Pathogenic']` | `'Pathogenic'`  | All agree                |
| `['Pathogenic', 'Benign', 'VUS']`            | `'Conflicting'` | Path vs Benign           |
| `['VUS', 'Benign']`                          | `'Conflicting'` | Minor conflict           |
| `['Likely Pathogenic', 'VUS', 'Pathogenic']` | `'Pathogenic'`  | Path priority, no Benign |

---

### 4. Data Fetching (`data-fetching.ts`)

**Purpose:** Retrieves variant data from external APIs (MyVariant.info and OncoKB).

#### 4.1 MyVariant.info Strategy (`fetchVariantData`)

**Multi-Strategy Approach:**

```
Strategy 1: Gene + Protein (Most Reliable)
├─ Query: dbnsfp.genename:BRAF AND dbnsfp.hgvsp:*V600E*
├─ Special: Stop codon handling (Q2288* → Q2288X OR Q2288Ter)
└─ Returns: Full variant annotation

Strategy 2: Genomic Coordinates
├─ Query: chr7:g.140453136A>T
└─ Direct lookup by HGVS genomic notation

Strategy 3: rsID Fallback
├─ Query: rs113488022
└─ dbSNP identifier lookup
```

**Stop Codon Handling:**

MyVariant.info stores stop codons as `X` or `Ter`, not `*`:

- User input: `NF1 Q2288*`
- Query: `dbnsfp.genename:NF1 AND (dbnsfp.hgvsp:*Q2288X* OR dbnsfp.hgvsp:*Q2288Ter*)`

**Data Extraction:**

```typescript
gnomadAF; // Population frequency (multiple paths checked)
cosmicCount; // COSMIC somatic mutation occurrences
clinvarSig; // RCV array → normalized significance
revel; // REVEL score (best single predictor)
cadd; // CADD Phred score
gerp; // GERP++ RS score (conservation)
sift; // SIFT prediction (D/T)
polyphen2; // PolyPhen2 HDIV prediction (D/B)
```

**ClinVar RCV Extraction:**

```typescript
// Prioritize d.clinvar (has full RCV data) over dbnsfp.clinvar (only has clnsig)
const clinvar = d.clinvar || dbnsfp?.clinvar;

// Handle both single RCV and array of RCVs
if (Array.isArray(clinvar.rcv)) {
  clinvarSig = clinvar.rcv.map((r) => r.clinical_significance).filter(Boolean);
}
```

#### 4.2 OncoKB Integration (`fetchOncoKBData`)

**API:** `https://www.oncokb.org/api/v1/annotate/mutations/byProteinChange`

**Requires:** `ONCOKB_API_KEY` environment variable

**Returns:**

```typescript
{
  found: boolean,
  oncogenic: "Oncogenic" | "Likely Oncogenic" | "Unknown" | "Neutral",
  highestSensitiveLevel: "LEVEL_1" | "LEVEL_2" | "LEVEL_3A" | "LEVEL_3B" | "LEVEL_4",
  highestResistanceLevel: string | null,
  therapeuticImplications: Array<{
    level: string,
    drug: string,
    cancerType: string
  }>
}
```

**OncoKB Levels:**

- **LEVEL_1/2:** FDA-approved therapy (Tier I)
- **LEVEL_3A/3B:** Clinical trial evidence (Tier II)
- **LEVEL_4:** Biological evidence (Tier II, not reported)

---

### 5. Classification Logic (`classification.ts`)

**Purpose:** Implements AMP/ASCO/CAP 2017 somatic variant classification guidelines.

#### 5.1 Variant Type Determination

```typescript
function determineVariantType(vaf: number | null): VariantType;
```

| VAF Range | Classification        | Interpretation                 |
| --------- | --------------------- | ------------------------------ |
| ≥90%      | Germline (Homozygous) | Likely inherited               |
| 45-55%    | Germline              | Likely inherited, heterozygous |
| <45%      | Somatic               | Acquired mutation              |
| null/0    | Unknown               | Insufficient data              |

#### 5.2 Technical Artifact Detection

```typescript
function detectTechnicalArtifact(parsed: ParsedVariant);
```

**Filters:**

1. **Low VAF (<5%):** Below reliable detection threshold
2. **3'UTR Variants:** `hgvs_c` contains `*` → Low clinical significance
3. **Homopolymer Indels:** `del[ACGT]{4,}` or `ins[ACGT]{4,}` → High sequencing artifact risk

#### 5.3 Computational Evidence Scoring

**Five Core Predictors** (MutationTaster excluded due to high false positive rate):

| Predictor     | Pathogenic Threshold | Benign Threshold | Weight                       |
| ------------- | -------------------- | ---------------- | ---------------------------- |
| **REVEL**     | >0.75                | <0.4             | Best single predictor        |
| **CADD**      | >20                  | <10              | Phred-scaled deleteriousness |
| **GERP**      | >4                   | <2               | Conservation score           |
| **SIFT**      | "D" (deleterious)    | "T" (tolerated)  | Functional impact            |
| **PolyPhen2** | "D" (damaging)       | "B" (benign)     | Structural impact            |

**Scoring Output:**

```typescript
{
  pathogenicCount: number,    // Number of pathogenic predictions
  benignCount: number,        // Number of benign predictions
  predictors: Array<{
    name: string,
    value: string | number,
    interpretation: "Pathogenic" | "Benign" | "Uncertain"
  }>
}
```

#### 5.4 Classification Algorithm

**Step-by-Step Process:**

```
┌─────────────────────────────────────────┐
│ 1. TECHNICAL ARTIFACT FILTER            │
│    - Low VAF (<5%)                      │
│    - 3'UTR variants                     │
│    - Homopolymer indels                 │
│    → Classification: "Not Detected"     │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│ 2. POPULATION FREQUENCY FILTER          │
│    - gnomAD AF >5% → Benign (BA1)       │
│    - gnomAD AF >1% → Likely Benign (BS1)│
│    - VAF ~50% + AF >0.01% + no path     │
│      → Likely Benign (Germline)         │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│ 3. AMP/ASCO/CAP TIER CLASSIFICATION     │
│                                         │
│ TIER I: Strong Clinical Significance    │
│ ├─ Level A: FDA-approved therapy        │
│ │   (OncoKB LEVEL_1/2)                  │
│ └─ Level B: Well-powered studies        │
│     (OncoKB + ClinVar + COSMIC >100)    │
│                                         │
│ TIER II: Potential Significance         │
│ ├─ Level C: Clinical trial evidence     │
│ │   (OncoKB LEVEL_3A/3B)                │
│ └─ Level D: Single strong source        │
│     (OncoKB oncogenic, ClinVar path,    │
│      COSMIC >50)                        │
│                                         │
│ TIER III: VUS                           │
│ ├─ Strong computational evidence        │
│ │   (REVEL >0.75, CADD >25)             │
│ └─ Borderline REVEL (0.5-0.75)          │
│                                         │
│ TIER IV: Benign/Likely Benign           │
│ ├─ ClinVar Benign                       │
│ ├─ ClinVar Conflicting + 3+ benign      │
│ │   predictors                          │
│ └─ No clinical DB + 4+ benign           │
│     predictors + REVEL <0.3             │
└─────────────────────────────────────────┘
```

#### 5.5 Special Classification Rules

**Rule 1: Conflicting ClinVar + Strong Benign Evidence**

```typescript
if (clinvarConflicting) {
  const hasStrongBenignEvidence =
    benignCount >= 3 && benignCount > pathogenicCount;
  const hasVeryStrongBenignEvidence =
    benignCount >= 4 && revel < 0.3 && benignCount >= pathogenicCount * 2;

  if (hasStrongBenignEvidence || hasVeryStrongBenignEvidence) {
    return {
      classification: "Likely Benign",
      tier: "Tier IV",
      reasoning: "ClinVar conflicting (excluded from analysis).
                  Strong benign computational evidence..."
    };
  }
}
```

**Rule 2: No Clinical Database + Strong Benign Evidence**

```typescript
if (!clinvarSig &&
    oncoKBUninformative &&
    cosmicCount === 0 &&
    benignCount >= 4 &&
    revel < 0.3 &&
    benignCount >= pathogenicCount * 3) {
  return {
    classification: "Likely Benign",
    tier: "Tier IV",
    reasoning: "No clinical database evidence.
                Strong benign computational predictions..."
  };
}
```

**Rule 3: Conflicting ClinVar Exclusion**

When ClinVar shows conflicting interpretations, it is **excluded** from classification logic but **included** in evidence display for transparency:

```typescript
const clinvarConflicting = clinvarSigLower.includes("conflicting");
const clinvarPathogenic =
  clinvarSigLower.includes("pathogenic") &&
  !clinvarSigLower.includes("likely") &&
  !clinvarConflicting; // ← Excluded if conflicting
```

---

## API Endpoint (`route.ts`)

**Endpoint:** `POST /api/public/genomic/classify`

**Request Body:**

```json
{
  "rawText": "BRAF V600E (c.1799T>A) chr7:g.140453136A>T rs113488022 VAF: 25.3"
}
```

**Response Structure:**

```json
{
  "success": true,
  "parsed": {
    /* ParsedVariant */
  },
  "variantType": "Somatic",
  "classification": {
    "classification": "Pathogenic",
    "tier": "Tier I (Level A)",
    "shouldReport": true,
    "reasoning": "FDA-approved therapy (OncoKB LEVEL_1)...",
    "evidence": {
      "clinicalDatabases": [
        "ClinVar: Conflicting",
        "OncoKB: Oncogenic",
        "COSMIC: 2847 occurrences"
      ],
      "computationalPredictors": [
        { "name": "REVEL", "value": "0.897", "interpretation": "Pathogenic" },
        { "name": "CADD", "value": "25.9", "interpretation": "Pathogenic" }
      ],
      "populationFrequency": "gnomAD AF: 0.0001%"
    }
  },
  "technicalArtifact": {
    "isArtifact": false,
    "reason": null
  },
  "variantData": {
    /* Full MyVariant.info response */
  },
  "oncokb": {
    /* Full OncoKB response */
  }
}
```

**Flow:**

```
POST Request
    ↓
Parse Variant Text
    ↓
Fetch MyVariant.info Data (3 strategies)
    ↓
Fetch OncoKB Data
    ↓
Determine Variant Type (VAF-based)
    ↓
Check Technical Artifacts
    ↓
Classify Variant (AMP/ASCO/CAP)
    ↓
Build Response
    ↓
Return JSON
```

---

## Testing & Validation

### Test Cases

All test cases passed with the refactored modular structure:

#### 1. Stop Codon Search (NF1 Q2288\*)

```bash
Input:  "NF1 Q2288* (c.6862C>T) 17:29665764:C:T NM_001042492.2 dbSNP: rsNone VAF 92"
Result: ✓ PASS
  - Classification: Pathogenic
  - ClinVar: Likely Pathogenic
  - Stop codon correctly converted to X/Ter for MyVariant.info query
```

#### 2. Conflicting ClinVar (ATM T2396S)

```bash
Input:  "ATM T2396S (c.7187C>G) 11:108199845:C:G NM_000051.3 dbSNP: rs370559102 VAF 42"
Result: ✓ PASS
  - Classification: Likely Benign
  - ClinVar: Conflicting (excluded from classification)
  - Reasoning: Strong benign computational evidence (4/5 predictors benign)
```

#### 3. Strong Benign Without Clinical DB (BRCA2 I1364L)

```bash
Input:  "BRCA2 I1364L (c.4090A>C) chr13:g.32912582A>C rs56248502 VAF 49"
Result: ✓ PASS
  - Classification: Likely Benign
  - ClinVar: None
  - REVEL: 0.114 (benign)
  - Reasoning: 4/5 predictors benign, REVEL <0.3
```

#### 4. Minor Conflict (CREBBP N984S)

```bash
Input:  "CREBBP N984S (c.2951A>G) chr16:g.3819284T>C NM_004380.2 rs150923988 VAF 51"
Result: ✓ PASS
  - Classification: Likely Benign
  - ClinVar: Conflicting (VUS vs Benign)
  - Reasoning: ClinVar conflicting excluded, 4/5 benign predictors
```

#### 5. Known Oncogenic (BRAF V600E)

```bash
Input:  "BRAF V600E VAF: 25.3"
Result: ✓ PASS
  - Classification: Pathogenic
  - ClinVar: Conflicting
  - OncoKB: Oncogenic (LEVEL_1 - FDA approved therapy)
  - Reasoning: FDA-approved therapy available
```

---

## Usage Examples

### Example 1: Simple Variant

```typescript
POST /api/public/genomic/classify
{
  "rawText": "EGFR L858R"
}
```

### Example 2: Complex Variant with Multiple Identifiers

```typescript
POST /api/public/genomic/classify
{
  "rawText": "TP53 R273H (c.818G>A) chr17:g.7577538G>A NM_000546.5 rs28934576 VAF: 38"
}
```

### Example 3: Indel

```typescript
POST /api/public/genomic/classify
{
  "rawText": "EGFR Exon 19 deletion E746_A750del (c.2235_2249del15) VAF: 42"
}
```

---

## Error Handling

### Insufficient Identifiers

```json
{
  "success": false,
  "error": "Could not extract sufficient variant identifiers",
  "parsed": {
    /* Partial parsing results */
  }
}
```

### API Failures

- **MyVariant.info timeout:** Returns empty result, continues with OncoKB
- **OncoKB timeout:** Returns null, continues with MyVariant.info data only
- **Both fail:** Classification uses only parsed identifiers (limited)

---

## Performance Characteristics

| Operation      | Time           | Notes                          |
| -------------- | -------------- | ------------------------------ |
| Parsing        | <1ms           | Regex-based, no external calls |
| MyVariant.info | 200-800ms      | 3 strategies, sequential       |
| OncoKB         | 300-1200ms     | Requires API key               |
| Classification | <5ms           | Pure computation               |
| **Total**      | **500-2000ms** | API latency dominant           |

**Optimization Strategies:**

- MyVariant.info and OncoKB fetched in parallel (when possible)
- Stop codon search optimization (OR query instead of multiple requests)
- ClinVar RCV prioritization (reduces redundant queries)

---

## References

1. **AMP/ASCO/CAP Guidelines:**
   - Li MM, et al. "Standards and guidelines for the interpretation and reporting of sequence variants in cancer." _J Mol Diagn_ 2017;19(1):4-23.

2. **External APIs:**
   - MyVariant.info: https://myvariant.info
   - OncoKB: https://www.oncokb.org
   - ClinVar: https://www.ncbi.nlm.nih.gov/clinvar/
   - COSMIC: https://cancer.sanger.ac.uk/cosmic

3. **Computational Predictors:**
   - REVEL: Ioannidis et al. _Am J Hum Genet_ 2016
   - CADD: Kircher et al. _Nat Genet_ 2014
   - GERP: Cooper et al. _Genome Res_ 2005

---

## Maintenance & Contributing

### Adding a New Predictor

1. **Update `types.ts`:**

   ```typescript
   interface VariantData {
     // ... existing fields
     newPredictor: number | null;
   }
   ```

2. **Update `data-fetching.ts` (extractVariantData):**

   ```typescript
   const newPredictorScore = (dbnsfp?.newpredictor as Record<string, unknown>)?.score;
   ```

3. **Update `classification.ts` (countComputationalEvidence):**
   ```typescript
   if (data.newPredictor !== null) {
     // Add scoring logic
   }
   ```

### Modifying Classification Rules

All classification logic is in `classification.ts` → `classifyVariant()` function.

**Structure:**

1. Technical artifact filter
2. Population frequency filter
3. Tier I classification
4. Tier II classification
5. Tier III classification
6. Tier IV classification
7. Default VUS

---

## License

This algorithm implementation is part of Pathology Bites and follows the project's license terms.
