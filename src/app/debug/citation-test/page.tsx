// src/app/debug/citation-test/page.tsx
'use client'

import { useState } from 'react'
import { formatAMA, formatVancouver, normalizeText } from '@/shared/utils/citation-formatters'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'

export default function CitationTestPage() {
  const [testJournal, setTestJournal] = useState('Biología Molecular')
  const [normalizedText, setNormalizedText] = useState('')

  const testCitation = {
    type: 'journal' as const,
    title: 'Análisis de la función cardíaca en pacientes con β-bloqueadores',
    authors: ['García, María José', 'Müller, Hans', 'Østerberg, Lars'],
    journal: testJournal,
    year: '2023',
    volume: '15',
    issue: '3',
    pages: '123-145',
    doi: '10.1234/example.2023.001'
  }

  const handleNormalize = () => {
    setNormalizedText(normalizeText(testJournal))
  }

  const amaResult = formatAMA(testCitation)
  const vancouverResult = formatVancouver(testCitation)

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Citation Formatter - Diacritics Test</h1>
        <p className="text-muted-foreground">
          Test the enhanced citation formatter with special characters and diacritics
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Text Normalization Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="journal">Journal Name (try with diacritics)</Label>
            <Input
              id="journal"
              value={testJournal}
              onChange={(e) => setTestJournal(e.target.value)}
              placeholder="e.g., Biología Molecular, Revista Española de Cardiología"
            />
          </div>
          <Button onClick={handleNormalize}>Normalize Text</Button>
          {normalizedText && (
            <div className="p-3 bg-muted rounded">
              <strong>Normalized:</strong> "{normalizedText}"
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Citation Examples</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold">Test Citation Data:</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li><strong>Title:</strong> Análisis de la función cardíaca en pacientes con β-bloqueadores</li>
              <li><strong>Authors:</strong> García, María José; Müller, Hans; Østerberg, Lars</li>
              <li><strong>Journal:</strong> {testJournal}</li>
              <li><strong>Year:</strong> 2023</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold">AMA Format:</h3>
            <div className="p-3 bg-muted rounded text-sm">
              {amaResult}
            </div>
          </div>

          <div>
            <h3 className="font-semibold">Vancouver Format:</h3>
            <div className="p-3 bg-muted rounded text-sm">
              {vancouverResult}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Test Cases</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Button 
              variant="outline" 
              onClick={() => setTestJournal('Biología Molecular')}
            >
              Test: Biología Molecular
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setTestJournal('Revista Española de Cardiología')}
            >
              Test: Revista Española de Cardiología
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setTestJournal('Archivos de Neurobiología')}
            >
              Test: Archivos de Neurobiología
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setTestJournal('Nature')}
            >
              Test: Nature (should abbreviate)
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setTestJournal('The New England Journal of Medicine')}
            >
              Test: NEJM (should abbreviate)
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Normalization Examples</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <strong>Original → Normalized</strong>
            </div>
            <div></div>
            <div>Biología</div>
            <div>→ {normalizeText('Biología')}</div>
            <div>Müller</div>
            <div>→ {normalizeText('Müller')}</div>
            <div>Østerberg</div>
            <div>→ {normalizeText('Østerberg')}</div>
            <div>François</div>
            <div>→ {normalizeText('François')}</div>
            <div>José María</div>
            <div>→ {normalizeText('José María')}</div>
            <div>β-Blockers & Co.</div>
            <div>→ {normalizeText('β-Blockers & Co.')}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
