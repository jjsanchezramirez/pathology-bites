/**
 * HTML Image Extractor
 * 
 * Utility to extract images from HTML content and clean the HTML for safe rendering
 * with Next.js Image components used separately.
 */

import { transformImagePath } from './r2-url-transformer'

export interface ExtractedImage {
  src: string
  alt: string
  originalSrc: string
}

export interface ProcessedHtmlContent {
  cleanHtml: string
  images: ExtractedImage[]
}

/**
 * Extract images from HTML content and return clean HTML + image data
 */
export function extractImagesFromHtml(html: string, isAnkiContent: boolean = false): ProcessedHtmlContent {
  if (!html) return { cleanHtml: html, images: [] }
  
  const images: ExtractedImage[] = []
  let cleanHtml = html
  
  // Match <img> tags and extract image information
  const imgRegex = /<img([^>]*?)>/gi
  let match
  
  while ((match = imgRegex.exec(html)) !== null) {
    const imgTag = match[0]
    const imgAttributes = match[1]
    
    // Extract src attribute
    const srcMatch = imgAttributes.match(/src=["']([^"']+)["']/i)
    if (!srcMatch) continue
    
    const originalSrc = srcMatch[1]
    const transformedSrc = transformImagePath(originalSrc, isAnkiContent)
    
    // Extract alt attribute (optional)
    const altMatch = imgAttributes.match(/alt=["']([^"']+)["']/i)
    const alt = altMatch ? altMatch[1] : ''
    
    images.push({
      src: transformedSrc,
      alt: alt || `Image ${images.length + 1}`,
      originalSrc
    })
    
    // Remove the img tag from HTML, replace with a placeholder
    cleanHtml = cleanHtml.replace(imgTag, `[IMAGE_${images.length - 1}]`)
  }
  
  return { cleanHtml, images }
}

/**
 * Replace image placeholders in HTML with custom content
 */
export function replaceImagePlaceholders(html: string, replacement: (index: number) => string): string {
  return html.replace(/\[IMAGE_(\d+)\]/g, (match, index) => {
    return replacement(parseInt(index))
  })
}

/**
 * Clean HTML content for safe rendering (remove remaining img tags if any)
 */
export function sanitizeHtmlForSafeRendering(html: string): string {
  // Remove any remaining img tags
  let sanitized = html.replace(/<img[^>]*>/gi, '[REMOVED IMAGE]')
  
  // Remove any onerror handlers or other potentially unsafe attributes
  sanitized = sanitized.replace(/onerror=["'][^"']*["']/gi, '')
  
  return sanitized
}

export default {
  extractImagesFromHtml,
  replaceImagePlaceholders,
  sanitizeHtmlForSafeRendering
}