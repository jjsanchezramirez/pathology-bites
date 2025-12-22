import { Card, CardContent } from '../ui/card'
import {
  Stethoscope,
  Eye,
  FlaskConical,
  Microscope,
  Dna,
  CheckCircle,
  AlertCircle,
  Info
} from 'lucide-react'

interface DiagnosticContentProps {
  content: any
  entity: string
}

/**
 * Display diagnostic content in a structured format
 * Handles the raw content object from educational files
 */
export function DiagnosticContent({ content, entity }: DiagnosticContentProps) {
  if (!content) return null

  // Check if this is AI-parsed content (has the structured format)
  const isAIParsed = !!(
    content.clinical_features ||
    content.histologic_findings ||
    content.immunohistochemistry ||
    content.differential_diagnosis ||
    content.molecular_findings
  )

  // Extract sections from content
  const sections = []

  // Helper to check if a section has content
  const hasContent = (data: any) => {
    if (Array.isArray(data)) return data.length > 0
    if (typeof data === 'object' && data !== null) {
      return Object.keys(data).length > 0
    }
    return !!data
  }

  // If AI-parsed, use the structured format directly
  if (isAIParsed) {
    if (hasContent(content.clinical_features)) {
      sections.push({
        title: 'Clinical Features',
        icon: Stethoscope,
        color: 'blue-500',
        data: content.clinical_features
      })
    }

    if (hasContent(content.histologic_findings)) {
      sections.push({
        title: 'Histologic Findings',
        icon: Eye,
        color: 'purple-500',
        data: content.histologic_findings
      })
    }

    if (hasContent(content.immunohistochemistry)) {
      sections.push({
        title: 'Immunohistochemistry',
        icon: FlaskConical,
        color: 'green-500',
        data: content.immunohistochemistry
      })
    }

    if (hasContent(content.differential_diagnosis)) {
      sections.push({
        title: 'Differential Diagnosis',
        icon: Microscope,
        color: 'orange-500',
        data: content.differential_diagnosis
      })
    }

    if (hasContent(content.molecular_findings)) {
      sections.push({
        title: 'Molecular Findings',
        icon: Dna,
        color: 'indigo-500',
        data: content.molecular_findings
      })
    }

    if (hasContent(content.additional_info)) {
      sections.push({
        title: 'Additional Information',
        icon: Info,
        color: 'gray-500',
        data: content.additional_info
      })
    }
  } else {
    // Fall back to old extraction logic for raw content
    // Clinical features / Epidemiology / Clinical Issues
  if (hasContent(content['CLINICAL ISSUES']) || hasContent(content.EPIDEMIOLOGY)) {
    sections.push({
      title: 'Clinical Features',
      icon: Stethoscope,
      color: 'blue-500',
      data: content['CLINICAL ISSUES'] || content.EPIDEMIOLOGY
    })
  }

  // Histologic features / Morphology / Microscopic
  if (hasContent(content.MICROSCOPIC) || hasContent(content.MORPHOLOGY)) {
    sections.push({
      title: 'Histologic Findings',
      icon: Eye,
      color: 'purple-500',
      data: content.MICROSCOPIC || content.MORPHOLOGY
    })
  }

  // Immunohistochemistry / Ancillary Tests
  if (hasContent(content['ANCILLARY TESTS']) || hasContent(content.IMMUNOHISTOCHEMISTRY)) {
    sections.push({
      title: 'Ancillary Tests',
      icon: FlaskConical,
      color: 'green-500',
      data: content['ANCILLARY TESTS'] || content.IMMUNOHISTOCHEMISTRY
    })
  }

  // Differential Diagnosis
  if (hasContent(content['DIFFERENTIAL DIAGNOSIS']) || hasContent(content.DIFFERENTIAL_DIAGNOSIS)) {
    sections.push({
      title: 'Differential Diagnosis',
      icon: Microscope,
      color: 'orange-500',
      data: content['DIFFERENTIAL DIAGNOSIS'] || content.DIFFERENTIAL_DIAGNOSIS
    })
  }

  // Molecular features (in ANCILLARY TESTS under Genetic Testing)
  if (hasContent(content.MOLECULAR)) {
    sections.push({
      title: 'Molecular Findings',
      icon: Dna,
      color: 'indigo-500',
      data: content.MOLECULAR
    })
  }

    // Additional sections (terminology, prognosis, etc.) - only for raw content
    if (hasContent(content.TERMINOLOGY)) {
      sections.push({ title: 'Terminology', icon: Info, color: 'gray-500', data: content.TERMINOLOGY })
    }
    if (hasContent(content.PROGNOSIS)) {
      sections.push({ title: 'Prognosis', icon: Info, color: 'gray-500', data: content.PROGNOSIS })
    }
    if (hasContent(content.TREATMENT)) {
      sections.push({ title: 'Treatment', icon: Info, color: 'gray-500', data: content.TREATMENT })
    }
  }

  // Render a data section
  const renderData = (data: any, depth: number = 0): React.ReactNode => {
    if (data === null || data === undefined) {
      return null
    }

    // Handle IHC structure (positive/negative arrays)
    if (data.positive || data.negative) {
      return (
        <div className="grid md:grid-cols-2 gap-6">
          {data.positive && data.positive.length > 0 && (
            <div>
              <h4 className="font-medium text-green-600 mb-3 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Positive Stains
              </h4>
              <ul className="space-y-1">
                {data.positive.map((item: string, idx: number) => (
                  <li key={idx} className="text-sm text-gray-700">
                    • {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {data.negative && data.negative.length > 0 && (
            <div>
              <h4 className="font-medium text-red-600 mb-3 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Negative Stains
              </h4>
              <ul className="space-y-1">
                {data.negative.map((item: string, idx: number) => (
                  <li key={idx} className="text-sm text-gray-700">
                    • {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )
    }

    if (Array.isArray(data)) {
      return (
        <ul className="space-y-2">
          {data.map((item, idx) => (
            <li key={idx} className="text-sm leading-relaxed text-gray-700">
              • {typeof item === 'string' ? item : renderDataItem(item, depth + 1)}
            </li>
          ))}
        </ul>
      )
    }

    if (typeof data === 'object') {
      return (
        <div className="space-y-4">
          {Object.entries(data).map(([key, value]) => (
            <div key={key}>
              <h4 className="font-medium text-sm mb-2 capitalize">
                {key.replace(/_/g, ' ')}
              </h4>
              {renderData(value, depth + 1)}
            </div>
          ))}
        </div>
      )
    }

    return <span className="text-sm leading-relaxed text-gray-700">{String(data)}</span>
  }

  // Add smart spacing to run-together text
  const addSmartSpacing = (text: string): string => {
    return text
      // Add space before capital letters that follow lowercase
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      // Add space before numbers that follow letters
      .replace(/([a-zA-Z])(\d)/g, '$1 $2')
      // Add space after numbers that precede letters
      .replace(/(\d)([a-zA-Z])/g, '$1 $2')
      // Add space before common medical terms
      .replace(/(positive|negative|stain|marker|mutation|translocation|expression|antibody|cells)/gi, ' $1')
      // Clean up multiple spaces
      .replace(/\s+/g, ' ')
      .trim()
  }

  // Render individual item (handles nested objects in arrays)
  const renderDataItem = (item: any, depth: number = 0): React.ReactNode => {
    if (item === null || item === undefined) {
      return null
    }

    // If it's an object with text/sub_points structure
    if (typeof item === 'object' && !Array.isArray(item)) {
      if (item.text) {
        const mainText = addSmartSpacing(String(item.text))
        return (
          <div className="space-y-2">
            <div className="leading-relaxed">{mainText}</div>
            {item.sub_points && Array.isArray(item.sub_points) && item.sub_points.length > 0 && (
              <ul className="ml-6 space-y-1 text-muted-foreground border-l-2 border-muted pl-3">
                {item.sub_points.map((subPoint: any, idx: number) => {
                  const subText = typeof subPoint === 'object'
                    ? addSmartSpacing(String(subPoint.text || subPoint))
                    : addSmartSpacing(String(subPoint))
                  return (
                    <li key={idx} className="text-sm">
                      • {subText}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )
      }
      // Generic object rendering
      return (
        <div className="ml-4 space-y-1 bg-muted/50 p-2 rounded">
          {Object.entries(item).map(([key, value]) => (
            <div key={key} className="text-xs">
              <span className="font-medium">{key.replace(/_/g, ' ')}: </span>
              {typeof value === 'object' ? JSON.stringify(value) : addSmartSpacing(String(value))}
            </div>
          ))}
        </div>
      )
    }

    // Primitive value
    return addSmartSpacing(String(item))
  }

  // If no structured sections found, display raw content
  if (sections.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Info className="h-5 w-5 text-gray-500" />
            <h3 className="text-lg font-semibold">Content for {entity}</h3>
          </div>
          <div className="prose prose-sm max-w-none">
            <pre className="text-xs bg-muted p-4 rounded overflow-auto">
              {JSON.stringify(content, null, 2)}
            </pre>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {sections.map((section, index) => {
        const Icon = section.icon
        return (
          <Card key={index}>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Icon className={`h-5 w-5 text-${section.color}`} />
                <h3 className="text-lg font-semibold">{section.title}</h3>
              </div>
              {renderData(section.data)}
            </CardContent>
          </Card>
        )
      })}

    </div>
  )
}
