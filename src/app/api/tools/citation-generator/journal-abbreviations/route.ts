import { NextResponse } from 'next/server'
import { createOptimizedResponse } from '@/shared/utils/compression'

// R2 URL for journal abbreviations (migrated from local file)
const JOURNAL_ABBREV_R2_URL = 'https://pub-a4bec7073d99465f99043c842be6318c.r2.dev/pathology-bites-data/nlm-journal-abbreviations.json'

export async function GET() {
  try {
    // Fetch from R2 instead of local file system (5-10MB file)
    const response = await fetch(JOURNAL_ABBREV_R2_URL, {
      headers: {
        'Cache-Control': 'public, max-age=86400' // 24 hour cache for stable data
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch journal abbreviations: ${response.status}`)
    }

    const data = await response.json()

    // Return with compression (60-80% bandwidth savings)
    return createOptimizedResponse(data, {
      compress: true,
      cache: {
        maxAge: 86400, // 24 hours (stable reference data)
        staleWhileRevalidate: 3600, // 1 hour
        public: true
      }
    })

  } catch (error) {
    console.error('Error loading journal abbreviations:', error)

    // Return fallback abbreviations with compression
    return createOptimizedResponse({
      abbreviations: {
        'New England Journal of Medicine': 'N Engl J Med',
        'Journal of the American Medical Association': 'JAMA',
        'The Lancet': 'Lancet',
        'Nature': 'Nature',
        'Science': 'Science',
        'Cell': 'Cell',
        'Proceedings of the National Academy of Sciences': 'Proc Natl Acad Sci U S A',
        'Journal of Clinical Investigation': 'J Clin Invest',
        'Blood': 'Blood',
        'Circulation': 'Circulation',
        'American Journal of Medicine': 'Am J Med',
        'British Medical Journal': 'BMJ',
        'Annals of Internal Medicine': 'Ann Intern Med',
        'Journal of Experimental Medicine': 'J Exp Med',
        'Nature Medicine': 'Nat Med',
        'Nature Genetics': 'Nat Genet',
        'Cancer Research': 'Cancer Res',
        'Clinical Cancer Research': 'Clin Cancer Res',
        'Journal of Biological Chemistry': 'J Biol Chem',
        'Molecular Cell': 'Mol Cell'
      }
    }, {
      compress: true,
      cache: {
        maxAge: 3600, // 1 hour for fallback
        public: true
      }
    })
  }
}
