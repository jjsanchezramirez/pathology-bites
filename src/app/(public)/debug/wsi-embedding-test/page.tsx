'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { WSIViewer, WSIEmbeddingViewer } from '@/shared/components/common/wsi-viewer'
import { TestTube, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'

const testCases = [
  {
    id: 'upmc_embeddable',
    name: 'UPMC Ameloblastoma (Should Embed)',
    status: 'embeddable',
    slide: {
      id: 'test_upmc',
      repository: 'UPMC',
      category: 'Head and Neck',
      subcategory: 'Odontogenic Tumors',
      diagnosis: 'Ameloblastoma',
      patient_info: 'Test case',
      age: null,
      gender: null,
      clinical_history: 'UPMC test slide - should embed successfully',
      stain_type: 'H&E',
      preview_image_url: '',
      slide_url: 'https://image.upmc.edu/Ameloblastoma/03-5999-3j-001.svs/view.apml?',
      case_url: 'https://image.upmc.edu/Ameloblastoma/03-5999-3j-001.svs/view.apml?',
      other_urls: [],
      source_metadata: { test: true }
    }
  },
  {
    id: 'leeds_blocked',
    name: 'Leeds Virtual Pathology (Blocked by X-Frame-Options)',
    status: 'blocked',
    slide: {
      id: 'test_leeds',
      repository: 'Leeds Virtual Pathology',
      category: 'Education',
      subcategory: 'Undergraduate',
      diagnosis: 'Leeds Teaching Slide',
      patient_info: 'Educational case',
      age: null,
      gender: null,
      clinical_history: 'Leeds slide - blocked by X-Frame-Options header',
      stain_type: 'H&E',
      preview_image_url: '',
      slide_url: 'https://www.virtualpathology.leeds.ac.uk/slides/library/view.php?path=%2FResearch_4%2FTeaching%2FEducation%2FUndergraduate%2F1082.svs',
      case_url: 'https://www.virtualpathology.leeds.ac.uk/slides/library/view.php?path=%2FResearch_4%2FTeaching%2FEducation%2FUndergraduate%2F1082.svs',
      other_urls: [],
      source_metadata: { test: true }
    }
  },
  {
    id: 'supabase_raw',
    name: 'Supabase Raw SVS File (Simple Viewer)',
    status: 'raw_file',
    slide: {
      id: 'test_supabase',
      repository: 'Supabase Storage',
      category: 'Test',
      subcategory: 'Raw WSI',
      diagnosis: 'CMU Small Region Test',
      patient_info: 'Test case',
      age: null,
      gender: null,
      clinical_history: 'Raw SVS file from Supabase - uses simple viewer',
      stain_type: 'H&E',
      preview_image_url: '',
      slide_url: 'https://htsnkuudinrcgfqlqmpi.supabase.co/storage/v1/object/public/wsi/CMU-1-Small-Region.svs',
      case_url: 'https://htsnkuudinrcgfqlqmpi.supabase.co/storage/v1/object/public/wsi/CMU-1-Small-Region.svs',
      other_urls: [],
      source_metadata: { test: true }
    }
  }
]

export default function WSIEmbeddingTestPage() {
  const [selectedTest, setSelectedTest] = useState(testCases[0])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'embeddable': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'blocked': return <XCircle className="h-4 w-4 text-red-500" />
      case 'raw_file': return <AlertTriangle className="h-4 w-4 text-amber-500" />
      default: return null
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'embeddable': return 'bg-green-100 text-green-800 border-green-200'
      case 'blocked': return 'bg-red-100 text-red-800 border-red-200'
      case 'raw_file': return 'bg-amber-100 text-amber-800 border-amber-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <TestTube className="h-8 w-8" />
          WSI Embedding Test Suite
        </h1>
        <p className="text-muted-foreground">
          Test different WSI repositories and file types to understand embedding behavior
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Test Case Selector */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Test Cases</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {testCases.map((testCase) => (
                <button
                  key={testCase.id}
                  onClick={() => setSelectedTest(testCase)}
                  className={`w-full p-3 text-left border rounded-lg transition-colors ${
                    selectedTest.id === testCase.id 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {getStatusIcon(testCase.status)}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{testCase.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {testCase.slide.repository}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Expected Behavior */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Expected Behavior</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Embeddable: Shows iframe viewer</span>
              </div>
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500" />
                <span>Blocked: Shows external link fallback</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span>Raw File: Shows simple file viewer</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Test Area */}
        <div className="lg:col-span-3 space-y-6">
          {/* Current Test Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                {selectedTest.name}
                <Badge className={getStatusColor(selectedTest.status)}>
                  {selectedTest.status.replace('_', ' ').toUpperCase()}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="font-medium">Repository:</div>
                  <div className="text-muted-foreground">{selectedTest.slide.repository}</div>
                </div>
                <div>
                  <div className="font-medium">Diagnosis:</div>
                  <div className="text-muted-foreground">{selectedTest.slide.diagnosis}</div>
                </div>
                <div className="md:col-span-2">
                  <div className="font-medium">URL:</div>
                  <div className="text-xs text-muted-foreground break-all font-mono bg-muted p-2 rounded mt-1">
                    {selectedTest.slide.slide_url}
                  </div>
                </div>
                <div className="md:col-span-2">
                  <div className="font-medium">Clinical History:</div>
                  <div className="text-muted-foreground">{selectedTest.slide.clinical_history}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* WSI Viewer Test */}
          <Card>
            <CardHeader>
              <CardTitle>WSI Viewer Result</CardTitle>
            </CardHeader>
            <CardContent>
              <WSIViewer 
                slide={selectedTest.slide}
                showMetadata={false}
              />
            </CardContent>
          </Card>

          {/* Simple Viewer Test (for raw files) */}
          {selectedTest.status === 'raw_file' && (
            <Card>
              <CardHeader>
                <CardTitle>Simple WSI Viewer (Alternative)</CardTitle>
              </CardHeader>
              <CardContent>
                <WSIEmbeddingViewer
                  url={selectedTest.slide.slide_url}
                  filename={selectedTest.slide.slide_url.split('/').pop()}
                  diagnosis={selectedTest.slide.diagnosis}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
