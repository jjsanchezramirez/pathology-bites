// src/shared/components/common/public-page-cta.tsx
import { Button } from "@/shared/components/ui/button"
import Link from "next/link"

interface PublicPageCTAProps {
  title: string
  description: string
  buttonText: string
  buttonHref: string
}

export function PublicPageCTA({ title, description, buttonText, buttonHref }: PublicPageCTAProps) {
  return (
    <section className="relative py-20">
      <div className="absolute inset-0 bg-linear-to-b from-transparent to-primary/5" />
      <div className="container px-4 max-w-3xl mx-auto text-center relative">
        <h2 className="text-3xl md:text-4xl font-bold mb-6">{title}</h2>
        <p className="text-xl text-muted-foreground mb-8">
          {description}
        </p>
        <Link href={buttonHref}>
          <Button
            size="lg"
            className="bg-primary hover:bg-primary/90 transform hover:scale-105
                      transition-all duration-300 ease-in-out"
          >
            {buttonText}
          </Button>
        </Link>
      </div>
    </section>
  )
}

