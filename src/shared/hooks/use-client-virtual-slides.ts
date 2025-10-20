"use client"

import { useEffect, useMemo, useState, useCallback } from 'react'
import { VirtualSlide } from '@/shared/types/virtual-slides'
import { getRepositoryFromId } from '@/shared/utils/repository'

// Module-scope cache so we only fetch once per session
let cachedSlidesPromise: Promise<VirtualSlide[]> | null = null

// Minimal client-entry type coming from CDN JSON
// Note: repository omitted (derived), title omitted (same as diagnosis)
interface ClientEntry {
  id: string
  diagnosis: string
  category: string
  subcategory: string
  acr?: string
  // Optional additional fields for UI rendering
  patient_info?: string
  age?: string | null
  gender?: string | null
  clinical_history?: string
  stain_type?: string
  preview_image_url?: string
  slide_url?: string
  case_url?: string
  other_urls?: string[]
}

function normalizeToVirtualSlide(e: ClientEntry): VirtualSlide {
  return {
    id: e.id,
    repository: getRepositoryFromId(e.id),
    category: e.category || '',
    subcategory: e.subcategory || '',
    diagnosis: e.diagnosis || '',
    patient_info: e.patient_info || '',
    age: e.age ?? null,
    gender: e.gender ?? null,
    clinical_history: e.clinical_history || '',
    stain_type: e.stain_type || '',
    preview_image_url: e.preview_image_url || '',
    image_url: undefined,
    slide_url: e.slide_url || '',
    case_url: e.case_url || '',
    other_urls: e.other_urls || [],
    source_metadata: {}
  }
}

async function loadClientSlides(): Promise<VirtualSlide[]> {
  if (cachedSlidesPromise) return cachedSlidesPromise

  const { VIRTUAL_SLIDES_JSON_URL } = await import('@/shared/config/virtual-slides')

  async function fetchWithFallback() {
    const fetchWithTimeout = async (input: RequestInfo | URL, init?: RequestInit & { timeoutMs?: number }) => {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), init?.timeoutMs ?? 8000)
      try {
        const res = await fetch(input, { ...init, signal: controller.signal })
        return res
      } finally {
        clearTimeout(timeout)
      }
    }

    try {
      const res = await fetchWithTimeout(VIRTUAL_SLIDES_JSON_URL, { cache: 'force-cache', timeoutMs: 8000 })
      if (!res.ok) throw new Error(`Failed: ${res.status}`)
      return res
    } catch (e: any) {
      const msg = e?.name === 'AbortError'
        ? 'Timed out fetching virtual slides. Please check your network and try again.'
        : (e?.message || 'Failed to fetch virtual slides dataset.')

      // In production, do NOT fall back to Vercel proxy to avoid bandwidth/invocations.
      if (process.env.NODE_ENV === 'production') {
        console.error('[VirtualSlides] R2 fetch failed in production. Check R2 CORS and network.', e)
        throw new Error(msg)
      }
      // In development, fallback to local proxy to ease testing when R2 CORS is not configured.
      console.warn('[VirtualSlides] R2 fetch failed in dev, falling back to /api/public/data/virtual-slides')
      return await fetchWithTimeout('/api/public/data/virtual-slides', { cache: 'force-cache', timeoutMs: 8000 })
    }
  }

  cachedSlidesPromise = fetchWithFallback()
    .then(async (res) => {
      if (!res.ok) throw new Error(`Failed to fetch client slides: ${res.status}`)
      const json = await res.json()
      // Support both array and wrapped formats
      const entries: ClientEntry[] = Array.isArray(json) ? json : (json.data ?? [])
      return entries.map(normalizeToVirtualSlide)
    })

  return cachedSlidesPromise
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isCompleteWordMatch(text: string, term: string): boolean {
  if (!term) return false
  const regex = new RegExp(`\\b${escapeRegex(term)}\\b`, 'i')
  return regex.test(text)
}

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) || [])
}

function makeAcr(words: string[]): string { return words.map(w => w[0]).join('') }

function rankSlides(slides: VirtualSlide[], query: string): VirtualSlide[] {
  const term = (query || '').toLowerCase().trim()
  if (!term) return slides

  const words = tokenize(term)
  const last = words[words.length - 1]
  const usePrefix = last && last.length >= 4
  const text = (s: VirtualSlide) => (s.diagnosis || '').toLowerCase()
  const acr = words.length >= 2 ? makeAcr(words) : ''

  const b1: VirtualSlide[] = [] // exact equality on diagnosis
  const b2: VirtualSlide[] = [] // word-boundary phrase
  const b3: VirtualSlide[] = [] // all tokens as complete words
  const b4: VirtualSlide[] = [] // acronym
  const b5: VirtualSlide[] = [] // any token as complete word
  const b6: VirtualSlide[] = [] // token prefix on last token
  const b7: VirtualSlide[] = [] // substring fallback

  for (const s of slides) {
    const d = text(s)
    if (!d) continue

    if (d === term) { b1.push(s); continue }
    if (isCompleteWordMatch(d, term)) { b2.push(s); continue }
    if (words.length > 0 && words.every(w => isCompleteWordMatch(d, w))) { b3.push(s); continue }
    if ((acr && acr === makeAcr(tokenize(d))) || (term.length >= 2 && term.length <= 5 && term === makeAcr(tokenize(d)))) { b4.push(s); continue }
    if (words.some(w => isCompleteWordMatch(d, w))) { b5.push(s); continue }
    if (usePrefix && tokenize(d).some(w => w.startsWith(last))) { b6.push(s); continue }
    if (d.includes(term)) { b7.push(s); continue }
  }

  return [...b1, ...b2, ...b3, ...b4, ...b5, ...b6, ...b7]
}

export interface ClientSearchOptions {
  query?: string
  repository?: string
  category?: string
  subcategory?: string
  randomMode?: boolean
  randomSeed?: number
  page?: number
  limit?: number
}

export function useClientVirtualSlides(defaultLimit: number = 20) {
  const [allSlides, setAllSlides] = useState<VirtualSlide[] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [options, setOptions] = useState<ClientSearchOptions>({ page: 1, limit: defaultLimit })

  useEffect(() => {
    let mounted = true
    setIsLoading(true)
    loadClientSlides()
      .then(slides => { if (mounted) setAllSlides(slides) })
      .catch(err => { if (mounted) setError(err.message || 'Failed to load slides') })
      .finally(() => { if (mounted) setIsLoading(false) })
    return () => { mounted = false }
  }, [])

  const repositories = useMemo(() => {
    if (!allSlides) return []
    return Array.from(new Set(
      allSlides.map(s => (s.repository || '').toString().trim())
    ))
      .filter(val => val.length > 0)
      .sort()
  }, [allSlides])

  const categories = useMemo(() => {
    if (!allSlides) return []
    return Array.from(new Set(
      allSlides.map(s => (s.category || '').toString().trim())
    ))
      .filter(val => val.length > 0)
      .sort()
  }, [allSlides])

  const organSystems = useMemo(() => {
    if (!allSlides) return []
    return Array.from(new Set(
      allSlides.map(s => (s.subcategory || '').toString().trim())
    ))
      .filter(val => val.length > 0)
      .sort()
  }, [allSlides])

  const filteredAndRanked = useMemo(() => {
    if (!allSlides) return []
    let list = allSlides
    // Filters first
    if (options.repository && options.repository !== 'all') {
      list = list.filter(s => s.repository === options.repository)
    }
    if (options.category && options.category !== 'all') {
      list = list.filter(s => s.category === options.category)
    }
    if (options.subcategory && options.subcategory !== 'all') {
      list = list.filter(s => s.subcategory === options.subcategory)
    }

    // Random mode: shuffle deterministically per page when enabled, ignoring query ranking
    if (options.randomMode) {
      const seedBase = options.randomSeed ?? Date.now()
      const seed = (options.page || 1) * 1337 + seedBase
      const rng = (n: number) => {
        const x = Math.sin(seed + n) * 10000
        return x - Math.floor(x)
      }
      let arr = list.slice()
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rng(i) * (i + 1))
        ;[arr[i], arr[j]] = [arr[j], arr[i]]
      }
      // In random mode, always show a small random sample of 10
      if (arr.length > 10) arr = arr.slice(0, 10)
      return arr
    }

    // Ranking next
    if (options.query && options.query.trim()) {
      list = rankSlides(list, options.query)
    }
    return list
  }, [allSlides, options])

  const total = filteredAndRanked.length
  const page = options.page || 1
  const limit = options.limit || defaultLimit
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const start = (page - 1) * limit
  const end = Math.min(start + limit, total)
  const pageSlides = filteredAndRanked.slice(start, end)

  // API-like controls
  const searchWithFilters = useCallback(async (opts: ClientSearchOptions) => {
    setOptions(prev => {
      const next = { ...prev } as any
      // page and limit: apply if provided, else keep existing (default at init)
      if (Object.prototype.hasOwnProperty.call(opts, 'page')) next.page = opts.page
      else if (!prev.page) next.page = 1
      if (Object.prototype.hasOwnProperty.call(opts, 'limit')) next.limit = opts.limit ?? prev.limit ?? defaultLimit

      // query and filters: apply even if undefined to allow clearing
      if (Object.prototype.hasOwnProperty.call(opts, 'query')) next.query = opts.query
      if (Object.prototype.hasOwnProperty.call(opts, 'repository')) next.repository = opts.repository
      if (Object.prototype.hasOwnProperty.call(opts, 'category')) next.category = opts.category
      if (Object.prototype.hasOwnProperty.call(opts, 'subcategory')) next.subcategory = opts.subcategory

      // random mode + seed
      if (Object.prototype.hasOwnProperty.call(opts, 'randomMode')) next.randomMode = opts.randomMode ?? false
      if (Object.prototype.hasOwnProperty.call(opts, 'randomSeed')) next.randomSeed = opts.randomSeed

      // Defaults
      if (next.limit == null) next.limit = prev.limit ?? defaultLimit
      if (next.page == null) next.page = 1
      return next
    })
  }, [defaultLimit])

  const search = useCallback(async (query: string, page: number = 1) => {
    await searchWithFilters({ query, page })
  }, [searchWithFilters])

  const nextPage = useCallback(async () => {
    if (page < totalPages) setOptions(prev => ({ ...prev, page: (prev.page || 1) + 1 }))
  }, [page, totalPages])

  const previousPage = useCallback(async () => {
    if (page > 1) setOptions(prev => ({ ...prev, page: (prev.page || 1) - 1 }))
  }, [page])

  const goToPage = useCallback(async (p: number) => {
    const clamped = Math.min(Math.max(1, p), totalPages)
    setOptions(prev => ({ ...prev, page: clamped }))
  }, [totalPages])

  return {
    // Data
    slides: pageSlides,
    isLoading,
    error,

    // Pagination
    currentPage: page,
    totalPages,
    totalResults: total,

    // Actions
    search,
    searchWithFilters,
    nextPage,
    previousPage,
    goToPage,

    // Metadata
    totalSlides: allSlides?.length || 0,
    repositories,
    categories,
    organSystems,

    currentSearchOptions: options
  }
}

