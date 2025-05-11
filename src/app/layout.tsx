// src/app/layout.tsx
import { ConditionalThemeProvider } from '@/components/theme/conditional-theme-provider'
import { Toaster } from "@/components/ui/toaster"
import { ConnectionStatus } from "@/components/network/connection-status"
import { cn } from '@/lib/utils'
import "@/styles/globals.css"

export const metadata = {
  title: 'Pathology Bites',
  description: 'Master Pathology with bite-sized learning',
  keywords: [
    'pathology qbank', 'AI-powered pathology questions', 'digital pathology learning', 'pathology board review', 'pathology board exam',
    'surgical pathology (SP)', 'clinical pathology (CP)', 'anatomic pathology', 'hematopathology', 'cytopathology', 'molecular pathology',
    'flow cytometry quizzes', 'immunohistochemistry cases', 'hematology scenarios', 'transfusion medicine simulations', 'lab management training',
    'pathology residency prep', 'medical student pathology', 'pathology CME credits', 'pathology MOC (Maintenance of Certification)',
    'pathology study materials', 'pathology flashcards', 'pathology quizzes', 'pathology image bank', 'virtual microscopy practice',
    'SPINDLE-style pathology questions', 'pathology differential diagnosis', 'pathology case simulations', 'machine learning pathology tutor',
    'adaptive learning pathology', 'pathology competency milestones', 'forensic pathology cases', 'pediatric pathology scenarios',
    'genomic pathology prep', 'digital cytopathology challenges', 'AI-driven autopsy simulations', 'pathology SPINDLE exam prep',
    'pathology study strategies', 'pathology study habits', 'pathology study skills', 'online pathology education', 'mobile pathology qbank',
    'pathology chat support', 'gamified pathology quizzes', 'pathology recertification', 'pathology fellowship resources',
    'pathology RISE exam practice', 'pathology image-based quizzes', 'pathology competency tracking', 'pathology board pass guarantee'
  ],
  authors: [{ name: 'Juan Jose Sanchez Ramirez, MD' }],
  creator: 'Juan Jose Sanchez Ramirez, MD',
  icons: {
    icon: [
      { url: '/icons/microscope.svg', type: 'image/svg+xml' },
    ]
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Don't try to initialize Supabase here at all since middleware handles auth
  // Just render the layout
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn('min-h-screen bg-background font-sans antialiased')}>
        <ConditionalThemeProvider attribute="class" defaultTheme="light">
          <div className="relative flex min-h-screen flex-col">
            {children}
          </div>
          <Toaster />
          <ConnectionStatus />
        </ConditionalThemeProvider>
      </body>
    </html>
  )
}