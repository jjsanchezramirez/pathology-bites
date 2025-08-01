import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const isbn = searchParams.get('isbn')
    
    if (!isbn) {
      return NextResponse.json({ error: 'ISBN parameter is required' }, { status: 400 })
    }
    
    // Clean ISBN (remove hyphens and spaces)
    const cleanIsbn = isbn.replace(/[-\s]/g, '')
    
    if (!cleanIsbn || cleanIsbn.length < 10) {
      return NextResponse.json({ error: 'Invalid ISBN format' }, { status: 400 })
    }
    
    // Try OpenLibrary first
    try {
      const openLibraryUrl = `https://openlibrary.org/api/books?bibkeys=ISBN:${cleanIsbn}&format=json&jscmd=data`

      const response = await fetch(openLibraryUrl, {
        headers: {
          'User-Agent': 'PathologyBites/1.0 (mailto:contact@pathologybites.com)'
        }
      })

      if (response.ok) {
        const data = await response.json()
        const bookKey = `ISBN:${cleanIsbn}`
        const book = data[bookKey]

        if (book) {
          // Ensure publisher is a string
          let publisher = 'Unknown Publisher'
          if (book.publishers && Array.isArray(book.publishers) && book.publishers.length > 0) {
            // Handle publisher objects with name property
            const publisherData = book.publishers[0]
            if (typeof publisherData === 'object' && publisherData.name) {
              publisher = publisherData.name
            } else if (typeof publisherData === 'string') {
              publisher = publisherData
            }
          } else if (book.publishers && typeof book.publishers === 'string') {
            publisher = book.publishers
          }

          return NextResponse.json({
            title: book.title || 'Unknown Title',
            authors: book.authors?.map((author: any) => author.name).filter((name: string) => name) || ['Unknown Author'],
            year: extractYearFromDate(book.publish_date),
            publisher: publisher,
            type: 'book'
          })
        }
      }
    } catch (error) {
      console.error('OpenLibrary API error:', error)
    }
    
    // Fallback to Google Books API
    try {
      const googleBooksUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}`
      
      const response = await fetch(googleBooksUrl, {
        headers: {
          'User-Agent': 'PathologyBites/1.0 (mailto:contact@pathologybites.com)'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        
        if (data.items && data.items.length > 0) {
          const book = data.items[0].volumeInfo

          // Ensure publisher is a string
          let publisher = 'Unknown Publisher'
          if (book.publisher && typeof book.publisher === 'string') {
            publisher = book.publisher
          }

          return NextResponse.json({
            title: book.title || 'Unknown Title',
            authors: book.authors || ['Unknown Author'],
            year: extractYearFromDate(book.publishedDate),
            publisher: publisher,
            type: 'book'
          })
        }
      }
    } catch (error) {
      console.error('Google Books API error:', error)
    }
    
    // If both APIs fail, return a fallback response
    return NextResponse.json({
      title: 'Unknown Title',
      authors: ['Unknown Author'],
      year: new Date().getFullYear().toString(),
      publisher: 'Unknown Publisher',
      type: 'book'
    })
    
  } catch (error) {
    console.error('Error extracting book metadata:', error)
    
    return NextResponse.json(
      { error: 'Failed to extract book metadata' },
      { status: 500 }
    )
  }
}

/**
 * Helper function to extract year from various date formats
 */
function extractYearFromDate(dateString: string): string {
  if (!dateString) return new Date().getFullYear().toString()
  
  const yearMatch = dateString.match(/\d{4}/)
  return yearMatch ? yearMatch[0] : new Date().getFullYear().toString()
}
