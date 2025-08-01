// Environment variable validation utility
import { z } from 'zod'

// Define the schema for required environment variables
const envSchema = z.object({
  // Supabase Configuration (Required)
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('Invalid Supabase URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'Supabase anon key is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'Supabase service role key is required').optional(),
  
  // Site Configuration
  NEXT_PUBLIC_SITE_URL: z.string().url('Invalid site URL').optional(),
  
  // Optional Services
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  NEXT_PUBLIC_VERCEL_ANALYTICS_ID: z.string().optional(),

  // Feature Flags
  NEXT_PUBLIC_MAINTENANCE_MODE: z.string().optional(),
  NEXT_PUBLIC_COMING_SOON_MODE: z.string().optional(),

  // Environment
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
})

export type EnvConfig = z.infer<typeof envSchema>

// Validate environment variables
export function validateEnv(): EnvConfig {
  try {
    const env = envSchema.parse(process.env)
    return env
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join('\n')
      throw new Error(`Environment validation failed:\n${missingVars}`)
    }
    throw error
  }
}

// Get validated environment variables
export const env = validateEnv()

// Helper functions for common environment checks
export const isDevelopment = env.NODE_ENV === 'development'
export const isProduction = env.NODE_ENV === 'production'
export const isTest = env.NODE_ENV === 'test'

// Supabase configuration helpers
export const getSupabaseConfig = () => ({
  url: env.NEXT_PUBLIC_SUPABASE_URL,
  anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
})

// Site configuration helpers
export const getSiteConfig = () => ({
  url: env.NEXT_PUBLIC_SITE_URL || env.NEXT_PUBLIC_SUPABASE_URL,
  googleClientId: env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
})

// Feature flag helpers
export const getFeatureFlags = () => ({
  maintenanceMode: process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true',
  comingSoonMode: process.env.NEXT_PUBLIC_COMING_SOON_MODE === 'true',
})

export const isMaintenanceMode = () => process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true'
export const isComingSoonMode = () => process.env.NEXT_PUBLIC_COMING_SOON_MODE === 'true'

// Validate specific service configurations
export const validateSupabaseConfig = () => {
  const config = getSupabaseConfig()
  
  if (!config.url || !config.anonKey) {
    throw new Error('Supabase configuration is incomplete. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }
  
  // Validate URL format
  try {
    new URL(config.url)
  } catch {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not a valid URL')
  }
  
  return config
}

// Runtime environment validation (for server-side)
export const validateServerEnv = () => {
  if (typeof window !== 'undefined') {
    throw new Error('validateServerEnv should only be called on the server side')
  }
  
  const config = getSupabaseConfig()
  
  if (!config.serviceRoleKey && isProduction) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY is not set. Some admin functions may not work.')
  }
  
  return config
}

// Client-side environment validation
export const validateClientEnv = () => {
  if (typeof window === 'undefined') {
    throw new Error('validateClientEnv should only be called on the client side')
  }
  
  const config = getSupabaseConfig()
  
  if (!config.url || !config.anonKey) {
    throw new Error('Client-side Supabase configuration is incomplete')
  }
  
  return {
    url: config.url,
    anonKey: config.anonKey,
  }
}
