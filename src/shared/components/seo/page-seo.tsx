// src/shared/components/seo/page-seo.tsx
import { Metadata } from 'next'
import { generateMetadata, SEOConfig } from '@/shared/utils/seo'
import { 
  BreadcrumbSchema, 
  QuestionSchema, 
  CourseSchema, 
  FAQSchema,
  StructuredData 
} from './structured-data'

interface PageSEOProps {
  config: SEOConfig
  breadcrumbs?: Array<{ name: string; url: string }>
  question?: {
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
  course?: {
    name: string
    description: string
    provider: string
    url: string
    category: string
    numberOfQuestions?: number
    estimatedDuration?: string
  }
  faqs?: Array<{
    question: string
    answer: string
  }>
  customSchema?: Record<string, any> | Record<string, any>[]
}

export function PageSEO({ 
  config, 
  breadcrumbs, 
  question, 
  course, 
  faqs, 
  customSchema 
}: PageSEOProps) {
  return (
    <>
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <BreadcrumbSchema items={breadcrumbs} />
      )}
      
      {/* Question Schema */}
      {question && (
        <QuestionSchema question={question} />
      )}
      
      {/* Course Schema */}
      {course && (
        <CourseSchema course={course} />
      )}
      
      {/* FAQ Schema */}
      {faqs && faqs.length > 0 && (
        <FAQSchema faqs={faqs} />
      )}
      
      {/* Custom Schema */}
      {customSchema && (
        <StructuredData data={customSchema} />
      )}
    </>
  )
}

// Helper function to generate metadata for common page types
export function generatePageMetadata(config: SEOConfig): Metadata {
  return generateMetadata(config)
}

// Specific metadata generators for common pages
export function generateHomePageMetadata(): Metadata {
  return generateMetadata({
    title: 'Free Pathology Education & Practice Questions',
    description: 'Master pathology with free practice questions, detailed explanations, and comprehensive study materials. Perfect for medical students, residents, and pathology professionals.',
    keywords: [
      'pathology education',
      'free pathology questions',
      'medical student resources',
      'pathology board prep',
      'histopathology quiz',
      'cytopathology practice',
    ],
    url: '/',
  })
}

export function generateAboutPageMetadata(): Metadata {
  return generateMetadata({
    title: 'About Pathology Bites - Free Medical Education',
    description: 'Learn about Pathology Bites, a free educational platform providing comprehensive pathology practice questions and study materials for medical students and professionals.',
    keywords: [
      'about pathology bites',
      'medical education platform',
      'free pathology resources',
      'pathology learning',
    ],
    url: '/about',
  })
}

export function generateCategoriesPageMetadata(): Metadata {
  return generateMetadata({
    title: 'Pathology Categories - Browse by Specialty',
    description: 'Browse pathology practice questions by category including anatomic pathology, clinical pathology, histopathology, cytopathology, and more.',
    keywords: [
      'pathology categories',
      'anatomic pathology',
      'clinical pathology',
      'histopathology',
      'cytopathology',
      'pathology specialties',
    ],
    url: '/categories',
  })
}

export function generateToolsPageMetadata(): Metadata {
  return generateMetadata({
    title: 'Pathology Tools & Resources',
    description: 'Free pathology tools including citation generators, reference formatters, and other educational resources for medical students and professionals.',
    keywords: [
      'pathology tools',
      'medical citation generator',
      'pathology resources',
      'medical reference tools',
    ],
    url: '/tools',
  })
}

export function generateVirtualSlidesPageMetadata(): Metadata {
  return generateMetadata({
    title: 'Virtual Pathology Slides - Interactive Learning',
    description: 'Explore virtual pathology slides from leading medical institutions. Interactive microscopy for enhanced pathology education.',
    keywords: [
      'virtual pathology slides',
      'digital pathology',
      'interactive microscopy',
      'pathology cases',
      'virtual slides',
    ],
    url: '/virtual-slides',
  })
}

export function generatePrivacyPageMetadata(): Metadata {
  return generateMetadata({
    title: 'Privacy Policy',
    description: 'Privacy policy for Pathology Bites. Learn how we protect your personal information and data while providing free pathology education.',
    keywords: ['privacy policy', 'data protection', 'user privacy'],
    url: '/privacy',
    noIndex: false, // Privacy pages should be indexed
  })
}

export function generateTermsPageMetadata(): Metadata {
  return generateMetadata({
    title: 'Terms of Service',
    description: 'Terms of service for Pathology Bites. Understand the terms and conditions for using our free pathology education platform.',
    keywords: ['terms of service', 'terms and conditions', 'user agreement'],
    url: '/terms',
    noIndex: false, // Terms pages should be indexed
  })
}
