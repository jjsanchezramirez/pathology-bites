import { NextRequest, NextResponse } from 'next/server'
import { createOptimizedResponse } from '@/shared/utils/compression'
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'

// R2 Configuration (same pattern as virtual slides)
function getR2Config() {
  const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID
  const CLOUDFLARE_R2_ACCESS_KEY_ID = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID
  const CLOUDFLARE_R2_SECRET_ACCESS_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY

  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_R2_ACCESS_KEY_ID || !CLOUDFLARE_R2_SECRET_ACCESS_KEY) {
    throw new Error('Missing required Cloudflare R2 environment variables')
  }

  return {
    CLOUDFLARE_ACCOUNT_ID,
    CLOUDFLARE_R2_ACCESS_KEY_ID,
    CLOUDFLARE_R2_SECRET_ACCESS_KEY
  }
}

function createR2Client() {
  const config = getR2Config()
  return new S3Client({
    region: 'auto',
    endpoint: `https://${config.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.CLOUDFLARE_R2_ACCESS_KEY_ID,
      secretAccessKey: config.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    },
  })
}

interface PathologySection {
  section: number;
  title: string;
  type: 'ap' | 'cp';
  items?: any[];
  subsections?: any[];
  line?: number;
  note?: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Pagination parameters
    const page = parseInt(searchParams.get('page') || '1')
    const sectionsPerPage = parseInt(searchParams.get('sectionsPerPage') || '7')
    
    // Filter parameters
    const sectionType = searchParams.get('type') // 'ap', 'cp', or 'all'
    const category = searchParams.get('category') // specific section number
    const search = searchParams.get('search')
    
    // Fetch data from R2 private bucket
    console.log('🔄 ABPath content specs API called - using R2 private bucket access')
    
    let data: any
    
    try {
      const r2Client = createR2Client()
      
      const command = new GetObjectCommand({
        Bucket: 'pathology-bites-data',
        Key: 'abpath-content-specs.json'
      })

      const response = await r2Client.send(command)
      
      if (!response.Body) {
        throw new Error('No response body from R2')
      }

      console.log('📊 R2 response received, parsing JSON...')
      const bodyContent = await response.Body.transformToString()
      const contentSize = bodyContent.length
      console.log('📏 Content size:', `${(contentSize / (1024 * 1024)).toFixed(1)}MB`)
      
      data = JSON.parse(bodyContent)
      console.log('✅ ABPath content specs parsed successfully')

    } catch (fetchError) {
      console.error('❌ ABPath content specs R2 fetch error:', fetchError)
      
      return NextResponse.json(
        { 
          error: 'Failed to fetch ABPath content specifications from R2 private bucket',
          details: (fetchError as any)?.message || 'Unknown error',
          bucket: 'pathology-bites-data',
          key: 'abpath-content-specs.json'
        },
        { status: 500 }
      )
    }
    
    if (!data || !data.content_specifications) {
      throw new Error('Invalid data structure in content specifications file')
    }

    // Combine sections based on type filter
    let allSections: PathologySection[] = []
    
    if (sectionType === 'ap') {
      allSections = data.content_specifications.ap_sections || []
    } else if (sectionType === 'cp') {
      allSections = data.content_specifications.cp_sections || []
    } else {
      // Default: both AP and CP
      allSections = [
        ...(data.content_specifications.ap_sections || []),
        ...(data.content_specifications.cp_sections || [])
      ]
    }

    // Apply category filter (specific section)
    if (category && category !== 'all') {
      const [filterType, sectionNum] = category.split('_')
      if (filterType && sectionNum) {
        allSections = allSections.filter(section =>
          section.type.toUpperCase() === filterType.toUpperCase() && 
          section.section.toString() === sectionNum
        )
      }
    }

    // Apply search filter (basic text search across titles and notes)
    if (search) {
      const searchLower = search.toLowerCase()
      allSections = allSections.filter(section => {
        const titleMatch = section.title.toLowerCase().includes(searchLower)
        const noteMatch = section.note?.toLowerCase().includes(searchLower)
        
        // Also search within items and subsections for comprehensive results
        let contentMatch = false
        
        if (section.items) {
          contentMatch = section.items.some((item: any) => 
            item.title?.toLowerCase().includes(searchLower) ||
            item.note?.toLowerCase().includes(searchLower)
          )
        }
        
        if (!contentMatch && section.subsections) {
          contentMatch = section.subsections.some((subsection: any) =>
            subsection.title?.toLowerCase().includes(searchLower) ||
            subsection.items?.some((item: any) =>
              item.title?.toLowerCase().includes(searchLower) ||
              item.note?.toLowerCase().includes(searchLower)
            )
          )
        }
        
        return titleMatch || noteMatch || contentMatch
      })
    }

    // Calculate pagination
    const totalSections = allSections.length
    const totalPages = Math.ceil(totalSections / sectionsPerPage)
    const startIndex = (page - 1) * sectionsPerPage
    const endIndex = startIndex + sectionsPerPage
    
    // Get sections for current page
    const paginatedSections = allSections.slice(startIndex, endIndex)

    // Calculate item counts for statistics
    const calculateItemCount = (sections: PathologySection[]): number => {
      return sections.reduce((total, section) => {
        let count = 0
        
        if (section.items) {
          count += section.items.length
          section.items.forEach((item: any) => {
            if (item.subitems) count += item.subitems.length
          })
        }
        
        if (section.subsections) {
          section.subsections.forEach((subsection: any) => {
            if (subsection.items) {
              count += subsection.items.length
              subsection.items.forEach((item: any) => {
                if (item.subitems) count += item.subitems.length
              })
            }
            if (subsection.sections) {
              subsection.sections.forEach((subSection: any) => {
                if (subSection.items) {
                  count += subSection.items.length
                  subSection.items.forEach((item: any) => {
                    if (item.subitems) count += item.subitems.length
                  })
                }
              })
            }
          })
        }
        
        return total + count
      }, 0)
    }

    const totalItems = calculateItemCount(allSections)
    const pageItems = calculateItemCount(paginatedSections)

    // Return paginated response
    return createOptimizedResponse({
      sections: paginatedSections,
      pagination: {
        currentPage: page,
        totalPages,
        sectionsPerPage,
        totalSections,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      },
      metadata: {
        ...data.metadata,
        totalItems,
        pageItems,
        filters: {
          type: sectionType || 'all',
          category: category || 'all',
          search: search || null
        }
      }
    }, {
      compress: true,
      cache: {
        maxAge: 86400, // 24 hours - static data can be cached aggressively
        staleWhileRevalidate: 300, // 5 minutes
        public: true
      }
    })

  } catch (error) {
    console.error('Error loading paginated content specifications:', error)
    
    return NextResponse.json(
      { error: 'Failed to load paginated content specifications' },
      { status: 500 }
    )
  }
}