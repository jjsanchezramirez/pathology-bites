/**
 * R2 URL Transformer
 * 
 * Utility to transform image URLs to use the correct Cloudflare R2 public URLs
 * for both cell quiz and anki media content.
 */

// Get R2 public URL from environment
// Use server-side env var on server, client-side env var on client
const getR2PublicUrl = () => {
  return process.env.CLOUDFLARE_R2_PUBLIC_URL || 'https://pub-a4bec7073d99465f99043c842be6318c.r2.dev'
}

const R2_PUBLIC_URL = getR2PublicUrl()

/**
 * Transform cell quiz image URLs to use R2 storage
 * Cell quiz images are stored in the 'cell-quiz/' folder
 */
export function transformCellQuizImageUrl(originalPath: string): string {
  if (!originalPath) return originalPath

  // Extract filename from original path
  const filename = originalPath.split('/').pop()
  if (!filename) return originalPath

  // Cell quiz images are stored in cell-quiz/ folder in R2
  // Remove any existing cell- prefix if present, then add cell-quiz/ folder
  const cleanFilename = filename.startsWith('cell-') ? filename.substring(5) : filename
  return `${R2_PUBLIC_URL}/cell-quiz/${cleanFilename}`
}

/**
 * Transform anki media URLs to use R2 storage
 * Anki media is stored in the anki/ directory
 */
export function transformAnkiMediaUrl(originalPath: string): string {
  if (!originalPath) return originalPath
  
  // If already an R2 URL, return as-is
  if (originalPath.includes('r2.dev') || originalPath.includes('r2.cloudflarestorage.com')) {
    return originalPath
  }
  
  // Extract filename from original path
  let filename = originalPath
  if (originalPath.includes('/')) {
    filename = originalPath.split('/').pop() || originalPath
  }
  
  // Anki media is stored in anki/ directory
  return `${R2_PUBLIC_URL}/anki/${filename}`
}

/**
 * Transform individual image path to use R2 URL
 * Used for direct image path transformations (not HTML content)
 */
export function transformImagePath(imagePath: string, isAnkiContent: boolean = false): string {
  if (!imagePath) return imagePath
  
  // Skip if already an R2 URL or external URL
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    if (imagePath.includes('r2.dev') || imagePath.includes('r2.cloudflarestorage.com')) {
      return imagePath // Already R2 URL
    }
    // External URL, leave as-is
    return imagePath
  }
  
  // Transform relative URLs
  if (isAnkiContent) {
    return transformAnkiMediaUrl(imagePath)
  } else {
    return transformCellQuizImageUrl(imagePath)
  }
}

/**
 * Transform image URLs in cell quiz data structure
 */
export function transformCellQuizData(cellData: any): any {
  if (!cellData || typeof cellData !== 'object') return cellData
  
  const transformed = { ...cellData }
  
  // Transform each cell type's images
  for (const [cellType, cellInfo] of Object.entries(transformed)) {
    if (cellInfo && typeof cellInfo === 'object' && Array.isArray((cellInfo as any).images)) {
      (cellInfo as any).images = (cellInfo as any).images.map((imagePath: string) => 
        transformCellQuizImageUrl(imagePath)
      )
    }
  }
  
  return transformed
}

/**
 * Transform image URLs in ankoma data structure
 * Note: This function extracts image paths from HTML content for use with Next.js Image components
 */
export function transformAnkomaData(ankomaData: any): any {
  if (!ankomaData) return ankomaData
  
  const extractAndTransformImagePaths = (htmlContent: string): { html: string; imagePaths: string[] } => {
    if (!htmlContent) return { html: htmlContent, imagePaths: [] }
    
    // Extract image paths from HTML for use with Next.js Image components
    const imgRegex = /<img[^>]*src=["']([^"']+)["'][^>]*>/gi
    const imagePaths: string[] = []
    let match
    
    while ((match = imgRegex.exec(htmlContent)) !== null) {
      const originalPath = match[1]
      const transformedPath = transformImagePath(originalPath, true)
      imagePaths.push(transformedPath)
    }
    
    return { html: htmlContent, imagePaths }
  }
  
  const transformNote = (note: any): any => {
    if (!note || !note.fields) return note
    
    const transformedNote = { ...note }
    transformedNote.extractedImages = []
    
    // Extract image paths from all fields for use with Next.js Image components
    transformedNote.fields = note.fields.map((field: string) => {
      const { html, imagePaths } = extractAndTransformImagePaths(field)
      transformedNote.extractedImages.push(...imagePaths)
      return html
    })
    
    return transformedNote
  }
  
  const transformDeck = (deck: any): any => {
    if (!deck) return deck
    
    const transformedDeck = { ...deck }
    
    // Transform notes in this deck
    if (deck.notes && Array.isArray(deck.notes)) {
      transformedDeck.notes = deck.notes.map(transformNote)
    }
    
    // Recursively transform child decks
    if (deck.children && Array.isArray(deck.children)) {
      transformedDeck.children = deck.children.map(transformDeck)
    }
    
    return transformedDeck
  }
  
  return transformDeck(ankomaData)
}

export default {
  transformCellQuizImageUrl,
  transformAnkiMediaUrl,
  transformImagePath,
  transformCellQuizData,
  transformAnkomaData
}