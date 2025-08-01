// src/app/sitemap.ts
import { MetadataRoute } from 'next'
import { createClient } from '@/shared/services/server'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pathologybites.com'
  const currentDate = new Date()
  
  // Static pages with high priority
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/categories`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/tools`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/tools/citations`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/virtual-slides`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: currentDate,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: currentDate,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]

  try {
    const supabase = await createClient()
    
    // Get all approved questions for public access
    const { data: questions } = await supabase
      .from('questions')
      .select('id, title, updated_at, status')
      .eq('status', 'approved')
      .order('updated_at', { ascending: false })
      .limit(1000) // Limit to prevent huge sitemaps

    // Get all categories with questions
    const { data: categories } = await supabase
      .from('categories')
      .select('id, name, slug, updated_at')
      .order('name')

    // Generate question pages
    const questionPages: MetadataRoute.Sitemap = questions?.map(question => ({
      url: `${baseUrl}/questions/${question.id}`,
      lastModified: new Date(question.updated_at),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })) || []

    // Generate category pages
    const categoryPages: MetadataRoute.Sitemap = categories?.map(category => ({
      url: `${baseUrl}/categories/${category.slug}`,
      lastModified: new Date(category.updated_at),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })) || []

    // Get virtual slides data for public access
    const { data: virtualSlides } = await supabase
      .from('virtual_slides')
      .select('id, diagnosis, updated_at')
      .order('diagnosis')
      .limit(500) // Limit virtual slides

    const virtualSlidePages: MetadataRoute.Sitemap = virtualSlides?.map(slide => ({
      url: `${baseUrl}/virtual-slides/${slide.id}`,
      lastModified: new Date(slide.updated_at),
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })) || []

    return [
      ...staticPages,
      ...categoryPages,
      ...questionPages,
      ...virtualSlidePages,
    ]

  } catch (error) {
    console.error('Error generating sitemap:', error)
    // Return static pages only if database query fails
    return staticPages
  }
}
