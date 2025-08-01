import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET() {
  try {
    // Read the journal abbreviations file from the data directory
    const filePath = path.join(process.cwd(), 'data', 'nlm-journal-abbreviations.json')
    
    if (!fs.existsSync(filePath)) {
      throw new Error('Journal abbreviations file not found')
    }
    
    const fileContent = fs.readFileSync(filePath, 'utf8')
    const data = JSON.parse(fileContent)
    
    return NextResponse.json(data)
    
  } catch (error) {
    console.error('Error loading journal abbreviations:', error)
    
    // Return fallback abbreviations
    return NextResponse.json({
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
    })
  }
}
