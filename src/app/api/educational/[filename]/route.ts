import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params

    // Validate filename to prevent directory traversal
    if (!filename || filename.includes('..') || !filename.endsWith('.json')) {
      return NextResponse.json(
        { error: 'Invalid filename' },
        { status: 400 }
      )
    }

    // Simple mapping of educational file names to basic content
    const educationalContent: Record<string, string> = {
      'anatomic-pathology.json': `{
  "category": "Anatomic Pathology",
  "description": "General anatomic pathology concepts covering tissue morphology, disease processes, and diagnostic criteria.",
  "topics": [
    "Cellular adaptations and injury",
    "Inflammation and repair", 
    "Neoplasia classification",
    "Organ-specific pathology"
  ],
  "sample_content": "Anatomic pathology involves the examination of surgically removed organs, tissues, and sometimes whole bodies (autopsies) to diagnose disease. Key areas include histopathology, cytopathology, and molecular pathology."
}`,

      'clinical-pathology.json': `{
  "category": "Clinical Pathology",
  "description": "Laboratory medicine focusing on analysis of body fluids, blood, and molecular diagnostics.",
  "topics": [
    "Clinical chemistry",
    "Hematology and coagulation",
    "Medical microbiology",
    "Immunology and serology"
  ],
  "sample_content": "Clinical pathology encompasses laboratory analysis of blood, urine, and other body fluids to diagnose disease and monitor treatment responses."
}`,

      'cytopathology.json': `{
  "category": "Cytopathology", 
  "description": "Study of cells obtained from various body sites for diagnostic purposes.",
  "topics": [
    "Cervical cytology screening",
    "Fine needle aspiration",
    "Body fluid cytology",
    "Molecular cytopathology"
  ],
  "sample_content": "Cytopathology involves examination of individual cells and small tissue fragments to diagnose diseases, particularly cancer screening and FNA biopsies."
}`,

      'dermatopathology.json': `{
  "category": "Dermatopathology",
  "description": "Specialized field focusing on skin diseases and conditions.",
  "topics": [
    "Inflammatory skin diseases",
    "Skin neoplasms",
    "Infectious dermatoses",
    "Genetic skin disorders"
  ],
  "sample_content": "Dermatopathology combines clinical dermatology with microscopic examination of skin biopsies to diagnose skin diseases and tumors."
}`,

      'forensic-pathology.json': `{
  "category": "Forensic Pathology",
  "description": "Application of pathology to legal investigations, particularly sudden or unexplained deaths.",
  "topics": [
    "Autopsy procedures",
    "Cause of death determination",
    "Trauma analysis",
    "Toxicology interpretation"
  ],
  "sample_content": "Forensic pathology involves investigation of sudden, unexpected, or violent deaths through autopsy and toxicological analysis."
}`,

      'hematopathology.json': `{
  "category": "Hematopathology",
  "description": "Study of diseases affecting blood, bone marrow, and lymphoid tissues.",
  "topics": [
    "Leukemia classification",
    "Lymphoma diagnosis", 
    "Bone marrow disorders",
    "Flow cytometry applications"
  ],
  "sample_content": "Hematopathology focuses on diseases of blood-forming organs including leukemias, lymphomas, and other hematologic malignancies."
}`,

      'molecular-pathology.json': `{
  "category": "Molecular Pathology",
  "description": "Integration of molecular techniques with traditional pathology for disease diagnosis.",
  "topics": [
    "Genetic mutations in cancer",
    "Molecular diagnostics",
    "Pharmacogenomics",
    "Precision medicine applications"
  ],
  "sample_content": "Molecular pathology uses DNA, RNA, and protein analysis to understand disease mechanisms and guide targeted therapies."
}`,

      'neuropathology.json': `{
  "category": "Neuropathology", 
  "description": "Study of nervous system diseases affecting brain, spinal cord, and peripheral nerves.",
  "topics": [
    "Neurodegenerative diseases",
    "Brain tumors",
    "Inflammatory CNS diseases",
    "Peripheral neuropathies"
  ],
  "sample_content": "Neuropathology examines diseases of the nervous system including tumors, degenerative diseases, and inflammatory conditions."
}`,

      'pediatric-pathology.json': `{
  "category": "Pediatric Pathology",
  "description": "Pathology specific to infants, children, and adolescents.",
  "topics": [
    "Congenital malformations",
    "Pediatric tumors",
    "Genetic disorders",
    "Perinatal pathology"
  ],
  "sample_content": "Pediatric pathology addresses diseases unique to or more common in children, including congenital anomalies and childhood cancers."
}`
    }

    const content = educationalContent[filename]
    if (!content) {
      return NextResponse.json(
        { error: 'Educational file not found' },
        { status: 404 }
      )
    }

    // Return as plain text (not JSON) since the frontend expects text
    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      }
    })

  } catch (error) {
    console.error('Error serving educational content:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}