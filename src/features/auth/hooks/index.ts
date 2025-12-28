// Barrel export for auth hooks
export * from './use-csrf-token'

// Re-export the main auth hook from shared
export { useAuth } from '@/shared/hooks/use-auth'
export { useAuth as default } from '@/shared/hooks/use-auth'
