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
          <p className="text-muted-foreground">© 2024 Pathology Bites. All rights reserved.</p>
        </div>
        <nav className="flex gap-6 text-muted-foreground">
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