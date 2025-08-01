// src/features/debug/components/ui-components-tab.tsx
/**
 * UI Components Tab - Showcase shadcn/ui components and comprehensive toast testing
 */

'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Input } from '@/shared/components/ui/input'
import { Textarea } from '@/shared/components/ui/textarea'
import { Label } from '@/shared/components/ui/label'
import { Switch } from '@/shared/components/ui/switch'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/shared/components/ui/radio-group'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert'
import { Progress } from '@/shared/components/ui/progress'
import { Separator } from '@/shared/components/ui/separator'
import { 
  Palette, 
  MessageSquare, 
  CheckCircle, 
  AlertCircle, 
  Info,
  AlertTriangle,
  Play,
  Pause,
  Settings,
  Star,
  Heart,
  ThumbsUp
} from 'lucide-react'
import { toast } from '@/shared/utils/toast'

// Import WSI Embedding Tab
import { WSIEmbeddingTab } from './wsi-embedding-tab'

export function UiComponentsTab() {
  const [progress, setProgress] = useState(33)
  const [switchValue, setSwitchValue] = useState(false)
  const [checkboxValue, setCheckboxValue] = useState(false)
  const [radioValue, setRadioValue] = useState('option1')
  const [inputValue, setInputValue] = useState('Sample text')
  const [textareaValue, setTextareaValue] = useState('Sample textarea content')

  // Toast testing functions
  const showBasicToast = () => {
    toast.success('Basic Toast', {
      description: 'This is a basic toast notification'
    })
  }

  const showSuccessToast = () => {
    toast.success('Success!', {
      description: 'Operation completed successfully'
    })
  }

  const showErrorToast = () => {
    toast.error('Error occurred', {
      description: 'Something went wrong with your request'
    })
  }

  const showWarningToast = () => {
    toast.warning('Warning', {
      description: 'Please check your input before proceeding'
    })
  }

  const showInfoToast = () => {
    toast.info('Information', {
      description: 'Here is some useful information for you'
    })
  }

  const showActionToast = () => {
    toast.success('Action Required', {
      description: 'Click the action button to proceed',
      action: {
        label: 'Undo',
        onClick: () => toast.success('Action executed!')
      }
    })
  }

  const showPromiseToast = () => {
    const promise = new Promise((resolve) => {
      setTimeout(() => resolve({ name: 'John Doe' }), 2000)
    })

    toast.promise(promise, {
      loading: 'Loading...',
      success: (data: any) => `Welcome ${data.name}!`,
      error: 'Error occurred'
    })
  }

  const showCustomToast = () => {
    toast.success('Custom Toast', {
      description: 'This toast has custom styling',
      duration: 5000,
      position: 'top-center'
    })
  }

  const showPersistentToast = () => {
    toast.success('Persistent Toast', {
      description: 'This toast will stay until dismissed',
      duration: Infinity
    })
  }

  const showMultipleToasts = () => {
    toast.success('First toast')
    setTimeout(() => toast.info('Second toast'), 500)
    setTimeout(() => toast.warning('Third toast'), 1000)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">UI Components</h2>
        <p className="text-gray-600">Showcase of shadcn/ui components and comprehensive toast testing</p>
      </div>

      <Tabs defaultValue="components" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="components">Components Showcase</TabsTrigger>
          <TabsTrigger value="wsi-embedding">WSI Image Embedding</TabsTrigger>
          <TabsTrigger value="toasts">Toast Testing</TabsTrigger>
        </TabsList>

        <TabsContent value="wsi-embedding" className="space-y-6">
          <WSIEmbeddingTab />
        </TabsContent>

        <TabsContent value="components" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Buttons */}
            <Card>
              <CardHeader>
                <CardTitle>Buttons</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button>Default</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="destructive">Destructive</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="link">Link</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm">Small</Button>
                  <Button size="default">Default</Button>
                  <Button size="lg">Large</Button>
                  <Button size="icon"><Settings className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>

            {/* Badges */}
            <Card>
              <CardHeader>
                <CardTitle>Badges</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge>Default</Badge>
                  <Badge variant="secondary">Secondary</Badge>
                  <Badge variant="destructive">Destructive</Badge>
                  <Badge variant="outline">Outline</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className="bg-green-100 text-green-800">Success</Badge>
                  <Badge className="bg-yellow-100 text-yellow-800">Warning</Badge>
                  <Badge className="bg-blue-100 text-blue-800">Info</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Form Elements */}
            <Card>
              <CardHeader>
                <CardTitle>Form Elements</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="input-demo">Input</Label>
                  <Input
                    id="input-demo"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Enter text..."
                  />
                </div>
                <div>
                  <Label htmlFor="textarea-demo">Textarea</Label>
                  <Textarea
                    id="textarea-demo"
                    value={textareaValue}
                    onChange={(e) => setTextareaValue(e.target.value)}
                    placeholder="Enter longer text..."
                    rows={3}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="switch-demo"
                    checked={switchValue}
                    onCheckedChange={setSwitchValue}
                  />
                  <Label htmlFor="switch-demo">Switch ({switchValue ? 'On' : 'Off'})</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="checkbox-demo"
                    checked={checkboxValue}
                    onCheckedChange={(checked) => setCheckboxValue(checked as boolean)}
                  />
                  <Label htmlFor="checkbox-demo">Checkbox</Label>
                </div>
              </CardContent>
            </Card>

            {/* Radio Group */}
            <Card>
              <CardHeader>
                <CardTitle>Radio Group</CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup value={radioValue} onValueChange={setRadioValue}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="option1" id="option1" />
                    <Label htmlFor="option1">Option 1</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="option2" id="option2" />
                    <Label htmlFor="option2">Option 2</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="option3" id="option3" />
                    <Label htmlFor="option3">Option 3</Label>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>

            {/* Progress */}
            <Card>
              <CardHeader>
                <CardTitle>Progress</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Progress</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="w-full" />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => setProgress(Math.max(0, progress - 10))}
                  >
                    -10%
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setProgress(Math.min(100, progress + 10))}
                  >
                    +10%
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Alerts */}
            <Card>
              <CardHeader>
                <CardTitle>Alerts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>Info</AlertTitle>
                  <AlertDescription>
                    This is an informational alert.
                  </AlertDescription>
                </Alert>
                <Alert className="border-yellow-200 bg-yellow-50">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <AlertTitle className="text-yellow-800">Warning</AlertTitle>
                  <AlertDescription className="text-yellow-700">
                    This is a warning alert.
                  </AlertDescription>
                </Alert>
                <Alert className="border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertTitle className="text-red-800">Error</AlertTitle>
                  <AlertDescription className="text-red-700">
                    This is an error alert.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="toasts" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Basic Toast Types */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <MessageSquare className="h-5 w-5" />
                  <span>Basic Toast Types</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button onClick={showBasicToast} className="w-full">
                  Basic Toast
                </Button>
                <Button onClick={showSuccessToast} className="w-full bg-green-600 hover:bg-green-700">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Success Toast
                </Button>
                <Button onClick={showErrorToast} variant="destructive" className="w-full">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Error Toast
                </Button>
                <Button onClick={showWarningToast} className="w-full bg-yellow-600 hover:bg-yellow-700">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Warning Toast
                </Button>
                <Button onClick={showInfoToast} className="w-full bg-blue-600 hover:bg-blue-700">
                  <Info className="h-4 w-4 mr-2" />
                  Info Toast
                </Button>
              </CardContent>
            </Card>

            {/* Advanced Toast Features */}
            <Card>
              <CardHeader>
                <CardTitle>Advanced Features</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button onClick={showActionToast} variant="outline" className="w-full">
                  Toast with Action
                </Button>
                <Button onClick={showPromiseToast} variant="outline" className="w-full">
                  <Play className="h-4 w-4 mr-2" />
                  Promise Toast
                </Button>
                <Button onClick={showCustomToast} variant="outline" className="w-full">
                  Custom Duration & Position
                </Button>
                <Button onClick={showPersistentToast} variant="outline" className="w-full">
                  <Pause className="h-4 w-4 mr-2" />
                  Persistent Toast
                </Button>
                <Button onClick={showMultipleToasts} variant="outline" className="w-full">
                  Multiple Toasts
                </Button>
              </CardContent>
            </Card>

            {/* Toast Information */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Toast System Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h4 className="font-semibold">Configuration</h4>
                    <div className="text-sm space-y-1">
                      <p><strong>Library:</strong> Sonner (React)</p>
                      <p><strong>Position:</strong> Bottom-right (default)</p>
                      <p><strong>Theme:</strong> Follows system theme</p>
                      <p><strong>Duration:</strong> 4000ms (default)</p>
                      <p><strong>Max Visible:</strong> 3 toasts</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h4 className="font-semibold">Features</h4>
                    <div className="text-sm space-y-1">
                      <p>✅ Multiple toast types (success, error, warning, info)</p>
                      <p>✅ Action buttons and custom content</p>
                      <p>✅ Promise-based toasts with loading states</p>
                      <p>✅ Custom duration and positioning</p>
                      <p>✅ Automatic stacking and dismissal</p>
                      <p>✅ Keyboard navigation support</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
