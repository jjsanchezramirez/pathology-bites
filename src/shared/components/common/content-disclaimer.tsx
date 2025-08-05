interface ContentDisclaimerProps {
  className?: string
}

export function ContentDisclaimer({ className = "" }: ContentDisclaimerProps) {
  return (
    <section className={`py-8 bg-muted/30 ${className}`}>
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="text-sm text-muted-foreground text-center">
          <span className="font-medium text-foreground">Content Disclaimer:</span>
          <span className="ml-2">
            This tool provides links to third-party whole slide image (WSI) repositories. We do not host, store, or claim ownership of any of the content linked. All copyrights remain with the respective content owners. Accessing and using external content is subject to each source's terms and conditions. No affiliation or endorsement is implied.
          </span>
        </div>
      </div>
    </section>
  )
}