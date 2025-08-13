// src/shared/components/seo/structured-data.tsx

interface StructuredDataProps {
  data: Record<string, any> | Record<string, any>[]
}

export function StructuredData({ data }: StructuredDataProps) {
  // Add safety check for data
  if (!data) {
    return null
  }

  const jsonLd = Array.isArray(data) ? data : [data]

  // Additional safety check for array elements
  const safeJsonLd = jsonLd.filter(item => item && typeof item === 'object')

  if (safeJsonLd.length === 0) {
    return null
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(safeJsonLd, null, 0),
      }}
    />
  )
}

// Specific structured data components for common use cases
interface OrganizationSchemaProps {
  name?: string
  url?: string
  logo?: string
  description?: string
  sameAs?: string[]
}

export function OrganizationSchema({
  name = 'Pathology Bites',
  url = process.env.NEXT_PUBLIC_SITE_URL || 'https://pathologybites.com',
  logo = '/images/logo.png',
  description = 'Free pathology education platform with practice questions and comprehensive study materials.',
  sameAs = [],
}: OrganizationSchemaProps) {
  // Ensure all required values are present
  if (!name || !url || !description) {
    return null
  }

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name,
    url,
    logo: `${url}${logo}`,
    description,
    sameAs: Array.isArray(sameAs) ? sameAs : [],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      availableLanguage: 'English',
    },
  }

  return <StructuredData data={schema} />
}

interface EducationalOrganizationSchemaProps {
  name?: string
  url?: string
  description?: string
}

export function EducationalOrganizationSchema({
  name = 'Pathology Bites',
  url = process.env.NEXT_PUBLIC_SITE_URL || 'https://pathologybites.com',
  description = 'Free pathology education platform providing comprehensive learning resources for medical students and professionals.',
}: EducationalOrganizationSchemaProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'EducationalOrganization',
    name,
    url,
    description,
    educationalCredentialAwarded: 'Medical Education Resources',
    hasCredential: 'Free Pathology Education Platform',
    audience: {
      '@type': 'EducationalAudience',
      educationalRole: ['student', 'medical student', 'resident', 'professional'],
    },
  }

  return <StructuredData data={schema} />
}

interface WebsiteSchemaProps {
  name?: string
  url?: string
  description?: string
  potentialAction?: any
}

export function WebsiteSchema({
  name = 'Pathology Bites',
  url = process.env.NEXT_PUBLIC_SITE_URL || 'https://pathologybites.com',
  description = 'Free pathology education platform with practice questions and study materials.',
  potentialAction,
}: WebsiteSchemaProps) {
  // Ensure all required values are present
  if (!name || !url || !description) {
    return null
  }

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name,
    url,
    description,
    ...(potentialAction && typeof potentialAction === 'object' && { potentialAction }),
  }

  return <StructuredData data={schema} />
}

interface BreadcrumbSchemaProps {
  items: Array<{
    name: string
    url: string
  }>
}

export function BreadcrumbSchema({ items }: BreadcrumbSchemaProps) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pathologybites.com'
  
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${baseUrl}${item.url}`,
    })),
  }

  return <StructuredData data={schema} />
}

interface QuestionSchemaProps {
  question: {
    title: string
    text: string
    options: string[]
    correctAnswer: string
    explanation: string
    category?: string
    difficulty?: string
    dateCreated?: string
    dateModified?: string
  }
}

export function QuestionSchema({ question }: QuestionSchemaProps) {
  const {
    title,
    text,
    options,
    correctAnswer,
    explanation,
    category,
    difficulty,
    dateCreated,
    dateModified,
  } = question

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Question',
    name: title,
    text,
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
    ...(dateCreated && { dateCreated }),
    ...(dateModified && { dateModified }),
    educationalLevel: 'Medical Education',
    learningResourceType: 'Practice Question',
  }

  return <StructuredData data={schema} />
}

interface CourseSchemaProps {
  course: {
    name: string
    description: string
    provider: string
    url: string
    category: string
    numberOfQuestions?: number
    estimatedDuration?: string
  }
}

export function CourseSchema({ course }: CourseSchemaProps) {
  const {
    name,
    description,
    provider,
    url,
    category,
    numberOfQuestions,
    estimatedDuration,
  } = course

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pathologybites.com'

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name,
    description,
    provider: {
      '@type': 'Organization',
      name: provider,
    },
    url: `${baseUrl}${url}`,
    courseCode: category,
    educationalLevel: 'Medical Education',
    teaches: category,
    ...(numberOfQuestions && {
      numberOfCredits: numberOfQuestions,
      hasCourseInstance: {
        '@type': 'CourseInstance',
        courseMode: 'online',
        ...(estimatedDuration && { duration: estimatedDuration }),
      },
    }),
    isAccessibleForFree: true,
    inLanguage: 'en',
  }

  return <StructuredData data={schema} />
}

interface FAQSchemaProps {
  faqs: Array<{
    question: string
    answer: string
  }>
}

export function FAQSchema({ faqs }: FAQSchemaProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  }

  return <StructuredData data={schema} />
}
