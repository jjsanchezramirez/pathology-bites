// src/shared/utils/seo.ts
import { Metadata } from 'next'

export interface SEOConfig {
  title?: string
  description?: string
  keywords?: string[]
  image?: string
  url?: string
  type?: 'website' | 'article' | 'profile'
  publishedTime?: string
  modifiedTime?: string
  authors?: string[]
  section?: string
  tags?: string[]
  noIndex?: boolean
  noFollow?: boolean
}

const DEFAULT_TITLE = 'Pathology Bites - Free Pathology Education & Practice Questions'
const DEFAULT_DESCRIPTION = 'Master pathology with free practice questions, detailed explanations, and comprehensive study materials. Perfect for medical students, residents, and pathology professionals.'
const DEFAULT_IMAGE = '/images/og-image.png'
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://pathologybites.com'

export function generateMetadata(config: SEOConfig = {}): Metadata {
  const {
    title,
    description = DEFAULT_DESCRIPTION,
    keywords = [],
    image = DEFAULT_IMAGE,
    url = '',
    type = 'website',
    publishedTime,
    modifiedTime,
    authors = [],
    section,
    tags = [],
    noIndex = false,
    noFollow = false,
  } = config

  const fullTitle = title ? `${title} | Pathology Bites` : DEFAULT_TITLE
  const fullUrl = `${SITE_URL}${url}`
  const fullImageUrl = image.startsWith('http') ? image : `${SITE_URL}${image}`

  const baseKeywords = [
    'pathology',
    'medical education',
    'practice questions',
    'pathology quiz',
    'medical students',
    'pathology residents',
    'anatomic pathology',
    'clinical pathology',
    'histopathology',
    'cytopathology',
  ]

  const allKeywords = [...baseKeywords, ...keywords].join(', ')

  const metadata: Metadata = {
    title: fullTitle,
    description,
    keywords: allKeywords,
    authors: authors.length > 0 ? authors.map(name => ({ name })) : [{ name: 'Pathology Bites Team' }],
    creator: 'Pathology Bites',
    publisher: 'Pathology Bites',
    openGraph: {
      type,
      locale: 'en_US',
      url: fullUrl,
      siteName: 'Pathology Bites',
      title: fullTitle,
      description,
      images: [
        {
          url: fullImageUrl,
          width: 1200,
          height: 630,
          alt: title || 'Pathology Bites - Free Pathology Education',
        },
      ],
      ...(publishedTime && { publishedTime }),
      ...(modifiedTime && { modifiedTime }),
      ...(section && { section }),
      ...(tags.length > 0 && { tags }),
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [fullImageUrl],
      creator: '@pathologybites',
      site: '@pathologybites',
    },
    robots: {
      index: !noIndex,
      follow: !noFollow,
      googleBot: {
        index: !noIndex,
        follow: !noFollow,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    alternates: {
      canonical: fullUrl,
    },
  }

  return metadata
}

export function generateQuestionMetadata(question: {
  title: string
  stem: string
  category?: string
  tags?: string[]
  id: string
}): Metadata {
  const { title, stem, category, tags = [], id } = question
  
  // Create a clean description from the question stem
  const cleanStem = stem.replace(/<[^>]*>/g, '').substring(0, 160)
  const description = `${cleanStem}... Practice this ${category || 'pathology'} question and more on Pathology Bites.`
  
  const keywords = [
    category?.toLowerCase(),
    ...tags.map(tag => tag.toLowerCase()),
    'pathology question',
    'medical quiz',
    'practice question',
  ].filter(Boolean) as string[]

  return generateMetadata({
    title,
    description,
    keywords,
    url: `/questions/${id}`,
    type: 'article',
    section: category,
    tags,
  })
}

export function generateCategoryMetadata(category: {
  name: string
  description?: string
  questionCount?: number
  slug: string
}): Metadata {
  const { name, description, questionCount, slug } = category
  
  const metaDescription = description || 
    `Practice ${name} pathology questions. ${questionCount ? `${questionCount} questions available.` : ''} Free practice questions with detailed explanations.`
  
  const keywords = [
    name.toLowerCase(),
    `${name.toLowerCase()} pathology`,
    `${name.toLowerCase()} questions`,
    'pathology practice',
    'medical education',
  ]

  return generateMetadata({
    title: `${name} Pathology Questions`,
    description: metaDescription,
    keywords,
    url: `/categories/${slug}`,
    section: name,
  })
}

export function generateQuizMetadata(quiz: {
  title?: string
  category?: string
  questionCount: number
  id: string
}): Metadata {
  const { title, category, questionCount, id } = quiz
  
  const quizTitle = title || `${category || 'Pathology'} Quiz`
  const description = `Take this ${questionCount}-question ${category || 'pathology'} quiz. Test your knowledge with detailed explanations for each answer.`
  
  const keywords = [
    category?.toLowerCase(),
    'pathology quiz',
    'medical quiz',
    'practice test',
    'pathology exam',
  ].filter(Boolean) as string[]

  return generateMetadata({
    title: quizTitle,
    description,
    keywords,
    url: `/quiz/${id}`,
    type: 'article',
    section: category,
  })
}

// Structured data generators
export function generateOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Pathology Bites',
    url: SITE_URL,
    logo: `${SITE_URL}/images/logo.png`,
    description: DEFAULT_DESCRIPTION,
    sameAs: [
      'https://twitter.com/pathologybites',
      // Add other social media URLs as they become available
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      availableLanguage: 'English',
    },
  }
}

export function generateEducationalOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'EducationalOrganization',
    name: 'Pathology Bites',
    url: SITE_URL,
    logo: `${SITE_URL}/images/logo.png`,
    description: DEFAULT_DESCRIPTION,
    educationalCredentialAwarded: 'Medical Education Resources',
    hasCredential: 'Free Pathology Education Platform',
  }
}

export function generateQuestionSchema(question: {
  title: string
  stem: string
  options: string[]
  correctAnswer: string
  explanation: string
  category?: string
  difficulty?: string
}) {
  const { title, stem, options, correctAnswer, explanation, category, difficulty } = question
  
  return {
    '@context': 'https://schema.org',
    '@type': 'Question',
    name: title,
    text: stem,
    acceptedAnswer: {
      '@type': 'Answer',
      text: correctAnswer,
      explanation,
    },
    suggestedAnswer: options.map(option => ({
      '@type': 'Answer',
      text: option,
    })),
    about: {
      '@type': 'Thing',
      name: category || 'Pathology',
    },
    ...(difficulty && {
      difficulty: {
        '@type': 'PropertyValue',
        name: 'Difficulty',
        value: difficulty,
      },
    }),
  }
}

export function generateBreadcrumbSchema(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}${item.url}`,
    })),
  }
}
