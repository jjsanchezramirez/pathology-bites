// Component to display references with clickable links

'use client'

import { ExternalLink, FileText } from 'lucide-react'
import { parseReferences, getPrimaryLink, getPDFLink, getLinkTypeLabel } from '@/shared/utils/reference-parser'
import { Button } from '@/shared/components/ui/button'

interface ReferencesListProps {
  references: string
  className?: string
}

export function ReferencesList({ references, className = '' }: ReferencesListProps) {
  const parsedReferences = parseReferences(references)

  if (parsedReferences.length === 0) {
    return null
  }

  return (
    <div className={`text-xs text-muted-foreground ${className}`}>
      <h4 className="font-medium uppercase mb-2">References</h4>
      <div className="space-y-3">
        {parsedReferences.map((ref, index) => {
          const primaryLink = getPrimaryLink(ref)
          const pdfLink = getPDFLink(ref)
          const linkLabel = getLinkTypeLabel(ref)

          return (
            <div key={index} className="flex items-start gap-2">
              {/* Link icon */}
              {primaryLink && (
                <a
                  href={primaryLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary/80 transition-colors mt-0.5 flex-shrink-0"
                  title={`Open ${linkLabel}`}
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}

              {/* Reference text */}
              <span className="break-words flex-1">
                {ref.text}
              </span>

              {/* PDF button if available */}
              {pdfLink && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  asChild
                >
                  <a
                    href={pdfLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="View PDF"
                  >
                    <FileText className="w-3 h-3 mr-1" />
                    PDF
                  </a>
                </Button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

