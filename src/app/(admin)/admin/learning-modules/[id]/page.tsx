// src/app/(admin)/admin/learning-modules/[id]/page.tsx

'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Edit, Eye, Users, Clock, Star, TrendingUp } from 'lucide-react'
import { useLearningModule } from '@/features/learning-modules/hooks'
import { ModuleContentViewer } from '@/features/learning-modules/components'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { format } from 'date-fns'

interface ViewLearningModulePageProps {
  params: Promise<{ id: string }>
}

export default function ViewLearningModulePage({ params }: ViewLearningModulePageProps) {
  const router = useRouter()
  const [moduleId, setModuleId] = React.useState<string>('')
  const { module, loading, error } = useLearningModule(moduleId, true)

  // Resolve params
  React.useEffect(() => {
    params.then(resolvedParams => {
      setModuleId(resolvedParams.id)
    })
  }, [params])

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !module) {
    return (
      <div className="p-6">
        <Alert>
          <AlertDescription>
            {error || 'Module not found'}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published': return 'bg-green-100 text-green-800'
      case 'draft': return 'bg-gray-100 text-gray-800'
      case 'review': return 'bg-yellow-100 text-yellow-800'
      case 'archived': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800'
      case 'intermediate': return 'bg-yellow-100 text-yellow-800'
      case 'advanced': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{module.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className={getStatusColor(module.status)}>
                {module.status}
              </Badge>
              <Badge variant="outline" className={getDifficultyColor(module.difficulty_level)}>
                {module.difficulty_level}
              </Badge>
              <span className="text-sm text-gray-500">
                Created {format(new Date(module.created_at), 'MMM d, yyyy')}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push(`/learning-modules/${module.id}`)}>
            <Eye className="h-4 w-4 mr-2" />
            View Public
          </Button>
          <Button onClick={() => router.push(`/admin/learning-modules/${module.id}/edit`)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit Module
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-3">
          <Tabs defaultValue="content" className="space-y-6">
            <TabsList>
              <TabsTrigger value="content">Content</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="content">
              <ModuleContentViewer
                module={module}
                isCompleted={false}
                showNavigation={false}
              />
            </TabsContent>

            <TabsContent value="analytics">
              <div className="space-y-6">
                {/* Analytics Overview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Total Views</p>
                          <p className="text-2xl font-bold text-gray-900">{module.view_count}</p>
                        </div>
                        <Eye className="h-8 w-8 text-blue-600" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Average Rating</p>
                          <p className="text-2xl font-bold text-gray-900">
                            {module.average_rating ? module.average_rating.toFixed(1) : 'N/A'}
                          </p>
                        </div>
                        <Star className="h-8 w-8 text-yellow-600" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Completion Rate</p>
                          <p className="text-2xl font-bold text-gray-900">--</p>
                        </div>
                        <TrendingUp className="h-8 w-8 text-green-600" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Detailed Analytics */}
                <Card>
                  <CardHeader>
                    <CardTitle>Performance Metrics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Average Completion Time:</span>
                        <span className="font-medium">
                          {module.average_completion_time_minutes 
                            ? `${module.average_completion_time_minutes} min` 
                            : 'No data'
                          }
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Rating Count:</span>
                        <span className="font-medium">{module.rating_count}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Content Type:</span>
                        <span className="font-medium capitalize">{module.content_type}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Estimated Duration:</span>
                        <span className="font-medium">{module.estimated_duration_minutes} min</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="settings">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Module Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-600">Module ID</label>
                        <p className="text-sm text-gray-900 font-mono">{module.id}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Slug</label>
                        <p className="text-sm text-gray-900 font-mono">{module.slug}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Category</label>
                        <p className="text-sm text-gray-900">{module.category?.name || 'No category'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Featured</label>
                        <p className="text-sm text-gray-900">{module.is_featured ? 'Yes' : 'No'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Created At</label>
                        <p className="text-sm text-gray-900">
                          {format(new Date(module.created_at), 'PPP')}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Updated At</label>
                        <p className="text-sm text-gray-900">
                          {format(new Date(module.updated_at), 'PPP')}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {module.learning_objectives && module.learning_objectives.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Learning Objectives</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {module.learning_objectives.map((objective, index) => (
                          <li key={index} className="flex items-start">
                            <span className="inline-block w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0" />
                            <span className="text-sm text-gray-700">{objective}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {module.external_content_url && (
                  <Card>
                    <CardHeader>
                      <CardTitle>External Content</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div>
                        <label className="text-sm font-medium text-gray-600">External URL</label>
                        <p className="text-sm text-blue-600 break-all">
                          <a href={module.external_content_url} target="_blank" rel="noopener noreferrer">
                            {module.external_content_url}
                          </a>
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Users className="h-4 w-4 text-gray-400 mr-2" />
                  <span className="text-sm text-gray-600">Views</span>
                </div>
                <span className="font-medium">{module.view_count}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Clock className="h-4 w-4 text-gray-400 mr-2" />
                  <span className="text-sm text-gray-600">Duration</span>
                </div>
                <span className="font-medium">{module.estimated_duration_minutes} min</span>
              </div>

              {module.average_rating && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Star className="h-4 w-4 text-gray-400 mr-2" />
                    <span className="text-sm text-gray-600">Rating</span>
                  </div>
                  <span className="font-medium">{module.average_rating.toFixed(1)}/5</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Related Modules */}
          {module.child_modules && module.child_modules.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Child Modules</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {module.child_modules.map((childModule: any) => (
                    <div key={childModule.id} className="p-2 bg-gray-50 rounded text-sm">
                      <p className="font-medium text-gray-900">{childModule.title}</p>
                      <p className="text-gray-600">{childModule.difficulty_level} • {childModule.estimated_duration_minutes} min</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Parent Module */}
          {module.parent_module && (
            <Card>
              <CardHeader>
                <CardTitle>Parent Module</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-2 bg-gray-50 rounded text-sm">
                  <p className="font-medium text-gray-900">{module.parent_module.title}</p>
                  <Button 
                    variant="link" 
                    size="sm" 
                    className="p-0 h-auto text-blue-600"
                    onClick={() => router.push(`/admin/learning-modules/${module.parent_module?.id}`)}
                  >
                    View Parent Module
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
