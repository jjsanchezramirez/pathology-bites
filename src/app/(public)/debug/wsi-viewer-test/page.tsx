'use client'

import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Badge } from '@/shared/components/ui/badge'
import { WSIViewer } from '@/shared/components/common/wsi-viewer'
import { TestTube, ExternalLink } from 'lucide-react'

const testSlides = [
  {
    id: 'test_upmc_ameloblastoma',
    repository: 'UPMC',
    category: 'Head and Neck',
    subcategory: 'Odontogenic Tumors',
    diagnosis: 'Ameloblastoma',
    patient_info: 'Test case',
    age: null,
    gender: null,
    clinical_history: 'UPMC test slide for iframe embedding',
    stain_type: 'H&E',
    preview_image_url: '',
    slide_url: 'https://image.upmc.edu/Ameloblastoma/03-5999-3j-001.svs/view.apml?',
    case_url: 'https://image.upmc.edu/Ameloblastoma/03-5999-3j-001.svs/view.apml?',
    other_urls: [],
    source_metadata: { test: true }
  },
  {
    id: 'test_leeds_undergraduate',
    repository: 'Leeds Virtual Pathology',
    category: 'Education',
    subcategory: 'Undergraduate',
    diagnosis: 'Leeds Teaching Slide',
    patient_info: 'Educational case',
    age: null,
    gender: null,
    clinical_history: 'Leeds virtual pathology teaching slide',
    stain_type: 'H&E',
    preview_image_url: '',
    slide_url: 'https://www.virtualpathology.leeds.ac.uk/slides/library/view.php?path=%2FResearch_4%2FTeaching%2FEducation%2FUndergraduate%2F1082.svs',
    case_url: 'https://www.virtualpathology.leeds.ac.uk/slides/library/view.php?path=%2FResearch_4%2FTeaching%2FEducation%2FUndergraduate%2F1082.svs',
    other_urls: [],
    source_metadata: { test: true, format: 'svs' }
  },
  {
    id: 'test_supabase_cmu',
    repository: 'Supabase Test',
    category: 'Test',
    subcategory: 'Debug',
    diagnosis: 'CMU Small Region Test',
    patient_info: 'Test case',
    age: null,
    gender: null,
    clinical_history: 'Supabase uploaded test slide',
    stain_type: 'H&E',
    preview_image_url: '',
    slide_url: 'https://htsnkuudinrcgfqlqmpi.supabase.co/storage/v1/object/public/wsi/CMU-1-Small-Region.svs',
    case_url: 'https://htsnkuudinrcgfqlqmpi.supabase.co/storage/v1/object/public/wsi/CMU-1-Small-Region.svs',
    other_urls: [],
    source_metadata: { test: true }
  }
]

export default function WSIViewerTestPage() {
  const [customUrl, setCustomUrl] = useState('')
  const [selectedSlide, setSelectedSlide] = useState(testSlides[0])
  const [showCustom, setShowCustom] = useState(false)

  const customSlide = {
    id: 'custom_test',
    repository: 'Custom Test',
    category: 'Test',
    subcategory: 'Custom',
    diagnosis: 'Custom Test Slide',
    patient_info: 'Custom test',
    age: null,
    gender: null,
    clinical_history: 'Custom URL test',
    stain_type: 'Unknown',
    preview_image_url: '',
    slide_url: customUrl,
    case_url: customUrl,
    other_urls: [],
    source_metadata: { custom: true }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <TestTube className="h-8 w-8" />
          WSI Viewer Test Page
        </h1>
        <p className="text-muted-foreground">
          Test iframe embedding and CSP policies for different WSI repositories
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Test Controls */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Test Slides</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {testSlides.map((slide) => (
                <Button
                  key={slide.id}
                  variant={selectedSlide.id === slide.id ? "default" : "outline"}
                  className="w-full justify-start text-left"
                  onClick={() => {
                    setSelectedSlide(slide)
                    setShowCustom(false)
                  }}
                >
                  <div className="text-left">
                    <div className="font-medium">{slide.repository}</div>
                    <div className="text-xs text-muted-foreground">{slide.diagnosis}</div>
                  </div>
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Custom URL Test</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label htmlFor="custom-url">WSI URL</Label>
                <Input
                  id="custom-url"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="Enter WSI URL to test"
                />
              </div>
              <Button
                onClick={() => setShowCustom(true)}
                disabled={!customUrl.trim()}
                className="w-full"
              >
                Test Custom URL
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Current Test</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-sm">
                <div className="font-medium">Repository:</div>
                <div className="text-muted-foreground">
                  {showCustom ? customSlide.repository : selectedSlide.repository}
                </div>
              </div>
              <div className="text-sm">
                <div className="font-medium">Diagnosis:</div>
                <div className="text-muted-foreground">
                  {showCustom ? customSlide.diagnosis : selectedSlide.diagnosis}
                </div>
              </div>
              <div className="text-sm">
                <div className="font-medium">URL:</div>
                <div className="text-xs text-muted-foreground break-all">
                  {showCustom ? customSlide.slide_url : selectedSlide.slide_url}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(showCustom ? customSlide.slide_url : selectedSlide.slide_url, '_blank')}
                className="w-full flex items-center gap-2"
              >
                <ExternalLink className="h-3 w-3" />
                Open in New Tab
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* WSI Viewer */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                WSI Viewer Test
                <Badge variant="outline">
                  {showCustom ? 'Custom' : selectedSlide.repository}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <WSIViewer 
                slide={showCustom ? customSlide : selectedSlide}
                showMetadata={true}
              />
            </CardContent>
          </Card>

          {/* CSP Status */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>CSP & Embedding Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div>
                  <div className="font-medium">Frame-src CSP Policy:</div>
                  <div className="text-muted-foreground text-xs font-mono bg-muted p-2 rounded mt-1">
                    frame-src 'self' https://accounts.google.com https://vercel.live https://image.upmc.edu https://*.supabase.co https://pathpresenter.net https://pathpresenter.blob.core.windows.net https://pathpresenter2.blob.core.windows.net https://learn.mghpathology.org https://virtualpathology.leeds.ac.uk https://www.virtualpathology.leeds.ac.uk https://dlm.lmp.utoronto.ca https://rosai.secondslide.com https://rosaicollection.net
                  </div>
                </div>
                <div>
                  <div className="font-medium">Expected Results:</div>
                  <ul className="text-muted-foreground text-xs space-y-1 mt-1">
                    <li>• UPMC slide should embed successfully</li>
                    <li>• Supabase slide should embed (raw .svs file)</li>
                    <li>• Other repositories should work if in CSP policy</li>
                    <li>• Blocked domains will show fallback with external link</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
