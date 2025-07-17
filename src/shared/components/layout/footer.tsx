/**
 * @source src/components/layout/footer.tsx
 *
 * Component that renders the footer section of the application.
 * It includes a copyright notice and a navigation menu with links to various pages.
 * The footer is styled with Tailwind CSS classes for layout and design.
 */

import Link from "next/link"
import { MicroscopeIcon } from "lucide-react"

export function Footer() {
  return (
    <footer className="border-t bg-background/95">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between h-16 text-sm">
        <div className="flex items-center gap-2">
          <MicroscopeIcon className="h-4 w-4 text-primary" />
          <p className="text-muted-foreground">© 2025 Pathology Bites. All rights reserved.</p>
        </div>
        <nav className="flex gap-6 text-muted-foreground">
          <div className="relative group">
            <span className="hover:text-primary transition-colors cursor-pointer">Tools</span>
            <div className="absolute bottom-full mb-2 left-0 bg-background border rounded-md shadow-lg p-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 min-w-48">
              <div className="space-y-1">
                <Link href="/tools/images" className="block px-3 py-2 text-sm hover:bg-muted rounded-sm">Image Database</Link>
                <Link href="/tools/cell-quiz" className="block px-3 py-2 text-sm hover:bg-muted rounded-sm">Hemepath Cell Quiz</Link>
                <Link href="/tools/gene-lookup" className="block px-3 py-2 text-sm hover:bg-muted rounded-sm">Gene Lookup</Link>
                <Link href="/tools/citations" className="block px-3 py-2 text-sm hover:bg-muted rounded-sm">Citations Generator</Link>
                <Link href="/tools/lupus-anticoagulant" className="block px-3 py-2 text-sm hover:bg-muted rounded-sm">Lupus Anticoagulant</Link>
                <Link href="/tools/abpath" className="block px-3 py-2 text-sm hover:bg-muted rounded-sm">ABPath Content</Link>
              </div>
            </div>
          </div>
          <Link href="/tools/virtual-slides" className="hover:text-primary transition-colors">Virtual Slides</Link>
          <Link href="/faq" className="hover:text-primary transition-colors">FAQ</Link>
          <Link href="/terms" className="hover:text-primary transition-colors">Terms</Link>
          <Link href="/privacy" className="hover:text-primary transition-colors">Privacy</Link>
          <Link href="/about" className="hover:text-primary transition-colors">About</Link>
          <Link href="/contact" className="hover:text-primary transition-colors">Contact</Link>
        </nav>
      </div>
    </footer>
  )
}