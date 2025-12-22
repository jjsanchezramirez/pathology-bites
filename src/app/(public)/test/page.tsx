'use client'

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import {
  TestTube2,
  Palette,
  Bell,
  Search,
  FileText,
  Zap,
  Database,
  Image as ImageIcon,
  ExternalLink
} from 'lucide-react'

interface TestPage {
  title: string
  description: string
  path: string
  category: 'Component' | 'Feature' | 'Integration' | 'System'
  icon: React.ReactNode
  status: 'stable' | 'beta' | 'experimental'
}

export default function TestIndexPage() {
  const testPages: TestPage[] = [
    {
      title: 'Toast Notifications Demo',
      description: 'Test all toast notification types, duplicate prevention, promise-based loading, and categorized toasts',
      path: '/test/toast-demo',
      category: 'Component',
      icon: <Bell className="h-5 w-5" />,
      status: 'stable'
    },
    {
      title: 'Diagnostic Search & NCI EVS',
      description: 'Test diagnostic search with AI content parsing, UMLS expansion, and NCI EVS API integration',
      path: '/test/diagnostic-search',
      category: 'Integration',
      icon: <Search className="h-5 w-5" />,
      status: 'stable'
    },
    {
      title: 'Cell Counter',
      description: 'Test interactive cell counting tool for pathology',
      path: '/tools/cell-counter',
      category: 'Feature',
      icon: <Zap className="h-5 w-5" />,
      status: 'stable'
    },
    {
      title: 'Virtual Slides Browser',
      description: 'Browse and search whole slide images (WSI) for pathology education',
      path: '/tools/images',
      category: 'Feature',
      icon: <ImageIcon className="h-5 w-5" />,
      status: 'stable'
    },
  ]

  const getCategoryColor = (category: TestPage['category']) => {
    switch (category) {
      case 'Component':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'Feature':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'Integration':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
      case 'System':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
    }
  }

  const getStatusColor = (status: TestPage['status']) => {
    switch (status) {
      case 'stable':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'beta':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'experimental':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    }
  }

  const groupedPages = testPages.reduce((acc, page) => {
    if (!acc[page.category]) {
      acc[page.category] = []
    }
    acc[page.category].push(page)
    return acc
  }, {} as Record<TestPage['category'], TestPage[]>)

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <TestTube2 className="h-8 w-8 text-primary" />
          <h1 className="text-4xl font-bold">Test & Demo Pages</h1>
        </div>
        <p className="text-muted-foreground text-lg">
          Interactive testing environments for components, features, and integrations
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{testPages.length}</div>
            <p className="text-xs text-muted-foreground">Total Test Pages</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">
              {testPages.filter(p => p.status === 'stable').length}
            </div>
            <p className="text-xs text-muted-foreground">Stable</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">
              {Object.keys(groupedPages).length}
            </div>
            <p className="text-xs text-muted-foreground">Categories</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-purple-600">
              {testPages.filter(p => p.category === 'Integration').length}
            </div>
            <p className="text-xs text-muted-foreground">Integrations</p>
          </CardContent>
        </Card>
      </div>

      {/* Test Pages by Category */}
      {Object.entries(groupedPages).map(([category, pages]) => (
        <div key={category} className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            {category} Tests
            <Badge variant="outline">{pages.length}</Badge>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pages.map((page) => (
              <Card key={page.path} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        {page.icon}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{page.title}</CardTitle>
                        <div className="flex gap-2 mt-1">
                          <Badge
                            variant="outline"
                            className={getCategoryColor(page.category)}
                          >
                            {page.category}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={getStatusColor(page.status)}
                          >
                            {page.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="mb-4">
                    {page.description}
                  </CardDescription>
                  <Link href={page.path}>
                    <Button className="w-full" variant="outline">
                      Open Test Page
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {/* Documentation Links */}
      <Card className="mt-8 bg-muted">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Documentation & Resources
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-2">System Documentation</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <code className="bg-background px-2 py-1 rounded">
                    docs/toast-system-architecture.md
                  </code>
                  <p className="text-muted-foreground ml-2">Toast system deep-dive</p>
                </li>
                <li>
                  <code className="bg-background px-2 py-1 rounded">
                    docs/toast-usage-guide.md
                  </code>
                  <p className="text-muted-foreground ml-2">How to use toasts</p>
                </li>
                <li>
                  <code className="bg-background px-2 py-1 rounded">
                    docs/README.md
                  </code>
                  <p className="text-muted-foreground ml-2">Full documentation index</p>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Testing Guides</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <code className="bg-background px-2 py-1 rounded">
                    tests/README.md
                  </code>
                  <p className="text-muted-foreground ml-2">Testing strategy overview</p>
                </li>
                <li>
                  <code className="bg-background px-2 py-1 rounded">
                    tests/unit/utils/toast/
                  </code>
                  <p className="text-muted-foreground ml-2">Toast unit tests</p>
                </li>
                <li>
                  <code className="bg-background px-2 py-1 rounded">
                    docs/nci-evs-tester-guide.md
                  </code>
                  <p className="text-muted-foreground ml-2">NCI EVS testing guide</p>
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Adding New Test Pages */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Adding New Test Pages</CardTitle>
          <CardDescription>
            To add a new test/demo page to this index, edit this file:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <code className="block bg-muted p-4 rounded-md text-sm">
            src/app/(public)/test/page.tsx
          </code>
          <p className="mt-4 text-sm text-muted-foreground">
            Add your page to the <code>testPages</code> array with title, description, path, category, icon, and status.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
