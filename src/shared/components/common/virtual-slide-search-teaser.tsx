'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Loader2 } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'

export function VirtualSlideSearchTeaser() {
  const [searchQuery, setSearchQuery] = useState('')
  const [isLuckyLoading, setIsLuckyLoading] = useState(false)
  const [isRandomLoading, setIsRandomLoading] = useState(false)
  const router = useRouter()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/tools/virtual-slides?search=${encodeURIComponent(searchQuery.trim())}`)
    } else {
      router.push('/tools/virtual-slides')
    }
  }

  const handleFeelingLucky = async () => {
    const query = searchQuery.trim()
    if (!query) {
      // If no search query, just go to virtual slides page
      router.push('/tools/virtual-slides')
      return
    }

    setIsLuckyLoading(true)
    try {
      // Use the same client-side data loading as the search page
      const { VIRTUAL_SLIDES_JSON_URL } = await import('@/shared/config/virtual-slides')

      const response = await fetch(VIRTUAL_SLIDES_JSON_URL, {
        cache: 'force-cache'
      })

      if (!response.ok) throw new Error('Failed to fetch slides')

      const json = await response.json()
      const slides = Array.isArray(json) ? json : (json.data ?? [])

      // Simple search: find first slide that matches query in diagnosis
      const term = query.toLowerCase()
      const firstMatch = slides.find((slide: unknown) =>
        slide.diagnosis?.toLowerCase().includes(term)
      )

      if (firstMatch) {
        const slideUrl = firstMatch.slide_url || firstMatch.case_url
        if (slideUrl) {
          window.location.href = slideUrl
        } else {
          router.push(`/tools/virtual-slides?search=${encodeURIComponent(query)}`)
        }
      } else {
        // No results found, go to search page
        router.push(`/tools/virtual-slides?search=${encodeURIComponent(query)}`)
      }
    } catch (error) {
      console.error('Feeling lucky search failed:', error)
      // Fallback to regular search
      router.push(`/tools/virtual-slides?search=${encodeURIComponent(query)}`)
    } finally {
      setIsLuckyLoading(false)
    }
  }

  const handleRandomSlide = async () => {
    setIsRandomLoading(true)
    try {
      // Use the same client-side data loading as the search page
      const { VIRTUAL_SLIDES_JSON_URL } = await import('@/shared/config/virtual-slides')

      const response = await fetch(VIRTUAL_SLIDES_JSON_URL, {
        cache: 'force-cache'
      })

      if (!response.ok) throw new Error('Failed to fetch slides')

      const json = await response.json()
      const slides = Array.isArray(json) ? json : (json.data ?? [])

      if (slides.length > 0) {
        const randomSlide = slides[Math.floor(Math.random() * slides.length)]
        const slideUrl = randomSlide.slide_url || randomSlide.case_url

        if (slideUrl) {
          window.location.href = slideUrl
        } else {
          router.push('/tools/virtual-slides?random=true')
        }
      } else {
        router.push('/tools/virtual-slides?random=true')
      }
    } catch (error) {
      console.error('Random slide fetch failed:', error)
      router.push('/tools/virtual-slides?random=true')
    } finally {
      setIsRandomLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto lg:mx-0">
      <form onSubmit={handleSearch} className="space-y-4">
        <div className="relative">
          <Search className="absolute left-5 top-1/2 transform -translate-y-1/2 h-6 w-6 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search 15,000+ virtual slides..."
            className="w-full pl-14 pr-28 py-5 rounded-xl border-2 border-input bg-background/50 backdrop-blur-sm text-base sm:text-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all hover:bg-background shadow-lg hover:shadow-xl"
          />
          <Button
            type="submit"
            size="lg"
            className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-primary hover:bg-primary/90 px-6 sm:px-8"
            disabled={isLuckyLoading}
          >
            Search
          </Button>
        </div>

        {/* Google-style button row */}
        <div className="flex gap-3 justify-center lg:justify-start">
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={handleRandomSlide}
            className="px-6"
            disabled={isLuckyLoading || isRandomLoading}
          >
            {isRandomLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              "Visit Random Slide"
            )}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={handleFeelingLucky}
            disabled={isLuckyLoading || isRandomLoading}
            className="px-6"
          >
            {isLuckyLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              "I'm Feeling Lucky"
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}

