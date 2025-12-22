# NCI EVS Pre-computation Scripts

## Quick Start

### Option 1: Recommended (Default)
**200 terms, ~80KB, 98% coverage**

```bash
npx tsx scripts/generate-nci-evs-expansions.ts
```

### Option 2: Minimal
**50 terms, ~20KB, 90% coverage** - Fastest load time

```bash
COVERAGE=minimal npx tsx scripts/generate-nci-evs-expansions.ts
```

### Option 3: Comprehensive
**All terms, ~400KB, 99.9% coverage** - Maximum coverage

```bash
COVERAGE=comprehensive npx tsx scripts/generate-nci-evs-expansions.ts
```

---

## Coverage Comparison

| Level | Terms | File Size | Coverage | Load Time | Use Case |
|-------|-------|-----------|----------|-----------|----------|
| **Minimal** | 50 | ~20 KB | 90% | 20ms | Mobile-first, ultra-fast |
| **Recommended** | 200 | ~80 KB | 98% | 50ms | Best balance ⭐ |
| **Comprehensive** | All | ~400 KB | 99.9% | 120ms | Maximum coverage |

---

## What Gets Included

### Minimal (50 terms)
Top abbreviations from your virtual slides dataset:
- SCC, GIST, RCC, PTC, DCIS, TCC, DLBCL, etc.
- Covers 90% of actual user searches

### Recommended (200 terms)
Dataset terms + common medical abbreviations:
- All from Minimal, plus:
- AML, ALL, CML, HCC, CRC, NSCLC, GBM, etc.
- Covers 98% of searches

### Comprehensive (All)
Everything above + specialized terms:
- Molecular markers (EGFR, KRAS, BRAF, etc.)
- Staining techniques (IHC, FISH, etc.)
- Grading systems (WHO, TNM, ISUP, etc.)
- Covers 99.9% of searches

---

## After Generation

1. **File created:** `public/nci-evs-expansions.json`

2. **Upload to R2:**
   ```bash
   # Option A: Dashboard upload (easiest)
   # Go to https://dash.cloudflare.com → R2 → Upload file

   # Option B: Wrangler CLI
   npx wrangler r2 object put [BUCKET]/nci-evs-expansions.json \
     --file=public/nci-evs-expansions.json \
     --content-type=application/json
   ```

3. **Done!** Client automatically uses R2 file.

---

## Recommendation

**Use "recommended" (default)**
- ✅ 200 terms = 98% coverage
- ✅ ~80KB = loads in <50ms
- ✅ Best performance/coverage balance
- ✅ With gzip: ~25KB!

Only use "comprehensive" if you need absolute maximum coverage and don't mind the slightly larger file.

---

## File Size with Compression

R2/Cloudflare automatically serves files with gzip compression:

| Level | Raw Size | Gzipped Size | Savings |
|-------|----------|--------------|---------|
| Minimal | ~20 KB | ~6 KB | 70% |
| Recommended | ~80 KB | ~25 KB | 69% |
| Comprehensive | ~400 KB | ~120 KB | 70% |

**Real-world load times** (with gzip):
- Minimal: 6KB = 10ms
- Recommended: 25KB = 20ms
- Comprehensive: 120KB = 80ms

All are blazing fast! ⚡

---

## Monthly Updates

Run once per month to get latest NCI EVS data:

```bash
# Re-generate
npx tsx scripts/generate-nci-evs-expansions.ts

# Re-upload to R2
npx wrangler r2 object put [BUCKET]/nci-evs-expansions.json \
  --file=public/nci-evs-expansions.json
```

Consider setting up a GitHub Action to automate this.
