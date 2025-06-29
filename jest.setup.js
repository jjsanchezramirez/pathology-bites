// Setup Jest DOM matchers
import '@testing-library/jest-dom'

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  })),
  useSearchParams: jest.fn(() => new URLSearchParams()),
  usePathname: jest.fn(() => '/'),
  redirect: jest.fn(),
}))

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000'

// Global test utilities
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Mock window.location
delete window.location
window.location = {
  href: 'http://localhost:3000',
  origin: 'http://localhost:3000',
  pathname: '/',
  search: '',
  hash: '',
  assign: jest.fn(),
  replace: jest.fn(),
  reload: jest.fn(),
}

// Polyfill for Request and Response
global.Request = class Request {
  constructor(url, options = {}) {
    this.url = url
    this.method = options.method || 'GET'
    this.headers = new Map()

    if (options.headers) {
      Object.entries(options.headers).forEach(([key, value]) => {
        this.headers.set(key.toLowerCase(), value)
      })
    }
  }

  get(name) {
    return this.headers.get(name.toLowerCase()) || null
  }
}

global.Response = class Response {
  constructor(body, options = {}) {
    this.body = body
    this.status = options.status || 200
    this.headers = new Map()

    if (options.headers) {
      Object.entries(options.headers).forEach(([key, value]) => {
        this.headers.set(key.toLowerCase(), value)
      })
    }
  }

  get(name) {
    return this.headers.get(name.toLowerCase()) || null
  }

  async json() {
    return JSON.parse(this.body)
  }
}

// Mock Request.headers.get method
global.Request.prototype.headers = {
  get: function(name) {
    return this._headers?.[name.toLowerCase()] || null
  }
}

// Increase timeout for async operations
jest.setTimeout(10000)
