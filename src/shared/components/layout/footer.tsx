/**
 * @source src/components/layout/footer.tsx
 *
 * Component that renders the footer section of the application.
 * It includes a copyright notice and a navigation menu with links to various pages.
 * The footer is styled with Tailwind CSS classes for layout and design.
 * Mobile-optimized with responsive navigation and accessible touch targets.
 */

"use client";

import Link from "next/link";
import { MicroscopeIcon, ChevronUp } from "lucide-react";
import { useState } from "react";

// Tool data with descriptive names and categories
const tools = [
  {
    category: "Images & Virtual Slides",
    items: [
      {
        href: "/tools/images",
        label: "Histologic Image Library",
        desc: "Browse our curated collection of pathology images",
      },
      {
        href: "/tools/virtual-slides",
        label: "Virtual Slide Search Engine",
        desc: "Access thousands of virtual pathology slides from leading institutions worldwide",
      },
    ],
  },
  {
    category: "Study & Practice",
    items: [
      {
        href: "/tools/cell-quiz",
        label: "Bone Marrow Morphology Quiz",
        desc: "Practice identifying cells and patterns in bone marrow samples",
      },
    ],
  },
  {
    category: "Laboratory Tools",
    items: [
      {
        href: "/tools/cell-counter",
        label: "Differential Cell Counter",
        desc: "Customizable differential calculator",
      },
      {
        href: "/tools/lupus-anticoagulant",
        label: "Lupus Anticoagulant Calculator",
        desc: "Interpret LAC assay results",
      },
    ],
  },
  {
    category: "Molecular & Genetics",
    items: [
      {
        href: "/tools/milan",
        label: "MILAN - Molecular Information",
        desc: "Look up gene information and biomarker associations",
      },
      {
        href: "/tools/genova",
        label: "GENOVA - GENomic Variant Analysis",
        desc: "Automated variant classification tool",
      },
    ],
  },
  {
    category: "Research & Misc Tools",
    items: [
      {
        href: "/tools/abpath",
        label: "ABPath Content Specifications",
        desc: "Interactive content specifications for ABPath AP/CP board exams",
      },
      {
        href: "/tools/citations",
        label: "Citation Manager",
        desc: "Generate and organize reference citations",
      },
    ],
  },
];

export function Footer() {
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isDesktopToolsOpen, setIsDesktopToolsOpen] = useState(false);

  const toggleTools = () => {
    setIsToolsOpen(!isToolsOpen);
  };

  const handleDesktopToolsEnter = () => {
    setIsDesktopToolsOpen(true);
  };

  const handleDesktopToolsLeave = () => {
    setIsDesktopToolsOpen(false);
  };

  return (
    <footer className="border-t bg-background/95">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-4">
        {/* Mobile-first layout */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 lg:gap-4">
          {/* Copyright section */}
          <div className="flex items-center justify-center lg:justify-start gap-2 order-2 lg:order-1">
            <MicroscopeIcon className="h-4 w-4 text-primary flex-shrink-0" />
            <p className="text-muted-foreground text-sm lg:text-xs text-center lg:text-left">
              © 2026 Pathology Bites. All rights reserved.
            </p>
          </div>

          {/* Navigation section */}
          <nav className="order-1 lg:order-2">
            {/* Mobile navigation - grid layout */}
            <div className="lg:hidden">
              {/* Primary mobile links */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <Link
                  href="/tools/virtual-slides"
                  className="flex items-center justify-center py-3 px-4 text-sm font-medium text-muted-foreground hover:text-primary hover:bg-muted/50 rounded-md transition-colors min-h-[44px]"
                >
                  Virtual Slides
                </Link>
                <Link
                  href="/faq"
                  className="flex items-center justify-center py-3 px-4 text-sm font-medium text-muted-foreground hover:text-primary hover:bg-muted/50 rounded-md transition-colors min-h-[44px]"
                >
                  FAQ
                </Link>
                <Link
                  href="/terms"
                  className="flex items-center justify-center py-3 px-4 text-sm font-medium text-muted-foreground hover:text-primary hover:bg-muted/50 rounded-md transition-colors min-h-[44px]"
                >
                  Terms
                </Link>
                <Link
                  href="/privacy"
                  className="flex items-center justify-center py-3 px-4 text-sm font-medium text-muted-foreground hover:text-primary hover:bg-muted/50 rounded-md transition-colors min-h-[44px]"
                >
                  Privacy
                </Link>
                <Link
                  href="/about"
                  className="flex items-center justify-center py-3 px-4 text-sm font-medium text-muted-foreground hover:text-primary hover:bg-muted/50 rounded-md transition-colors min-h-[44px]"
                >
                  About
                </Link>
                <Link
                  href="/contact"
                  className="flex items-center justify-center py-3 px-4 text-sm font-medium text-muted-foreground hover:text-primary hover:bg-muted/50 rounded-md transition-colors min-h-[44px]"
                >
                  Contact
                </Link>
              </div>

              {/* Mobile Tools section - collapsible */}
              <div className="border-t pt-4">
                <button
                  onClick={toggleTools}
                  className="flex items-center justify-center w-full py-3 px-4 text-sm font-medium text-muted-foreground hover:text-primary hover:bg-muted/50 rounded-md transition-colors min-h-[44px] gap-2"
                  aria-expanded={isToolsOpen}
                  aria-controls="mobile-tools-menu"
                >
                  Tools
                  <ChevronUp
                    className={`h-4 w-4 transition-transform duration-200 ${isToolsOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {isToolsOpen && (
                  <div id="mobile-tools-menu" className="mt-2 space-y-4">
                    {tools.map((category) => (
                      <div key={category.category}>
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                          {category.category}
                        </h4>
                        <div className="grid grid-cols-1 gap-1">
                          {category.items.map((tool) => (
                            <Link
                              key={tool.href}
                              href={tool.href}
                              className="flex flex-col py-2 px-3 text-sm text-muted-foreground hover:text-primary hover:bg-muted/50 rounded-md transition-colors"
                            >
                              <span className="font-medium">{tool.label}</span>
                              <span className="text-xs opacity-70">{tool.desc}</span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Desktop navigation - horizontal layout */}
            <div className="hidden lg:flex gap-8 text-sm text-muted-foreground items-center">
              {/* Tools dropdown - always visible */}
              <div
                className="relative"
                onMouseEnter={handleDesktopToolsEnter}
                onMouseLeave={handleDesktopToolsLeave}
              >
                <span className="hover:text-primary transition-colors cursor-pointer py-2 px-2 block font-medium">
                  Tools
                </span>
                <div
                  className={`absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-background border rounded-lg shadow-xl p-4 min-w-[720px] z-50 transition-all duration-200 ${isDesktopToolsOpen ? "opacity-100 visible" : "opacity-0 invisible"}`}
                >
                  {/* 3-column grid layout */}
                  <div className="grid grid-cols-3 gap-6">
                    {tools.map((category) => (
                      <div key={category.category}>
                        <h4 className="text-xs font-semibold text-primary uppercase tracking-wider mb-3 pb-1 border-b">
                          {category.category}
                        </h4>
                        <div className="space-y-1">
                          {category.items.map((tool) => (
                            <Link
                              key={tool.href}
                              href={tool.href}
                              className="block px-2 py-1.5 text-sm hover:bg-muted rounded transition-colors group"
                            >
                              <span className="font-medium text-foreground group-hover:text-primary block">
                                {tool.label}
                              </span>
                              <span className="text-xs text-muted-foreground group-hover:text-muted-foreground/80">
                                {tool.desc}
                              </span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <Link
                href="/tools/virtual-slides"
                className="hover:text-primary transition-colors py-2"
              >
                Virtual Slides
              </Link>
              <Link href="/faq" className="hover:text-primary transition-colors py-2">
                FAQ
              </Link>
              <Link href="/terms" className="hover:text-primary transition-colors py-2">
                Terms
              </Link>
              <Link href="/privacy" className="hover:text-primary transition-colors py-2">
                Privacy
              </Link>
              <Link href="/about" className="hover:text-primary transition-colors py-2">
                About
              </Link>
              <Link href="/contact" className="hover:text-primary transition-colors py-2">
                Contact
              </Link>
            </div>
          </nav>
        </div>
      </div>
    </footer>
  );
}
