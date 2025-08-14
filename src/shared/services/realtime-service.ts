// src/shared/services/realtime-service.ts
// Centralized realtime subscription service to reduce duplicate subscriptions

import { createClient } from '@/shared/services/client'
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js'

type AuthListener = (event: AuthChangeEvent, session: Session | null) => void
type DatabaseListener = (payload: any) => void

interface DatabaseSubscription {
  table: string
  event: string
  filter?: string
  callback: DatabaseListener
}

class RealtimeService {
  private static instance: RealtimeService
  private supabase = createClient()

  // Auth subscription management
  private authSubscription: any = null
  private authListeners: Set<AuthListener> = new Set()

  // Database subscription management
  private databaseSubscriptions: Map<string, any> = new Map()
  private databaseListeners: Map<string, Set<DatabaseListener>> = new Map()

  private constructor() {
    // Only initialize auth subscription if not on a public page
    if (typeof window !== 'undefined') {
      const isPublicPage = window.location.pathname.startsWith('/tools/') ||
                          window.location.pathname === '/' ||
                          window.location.pathname.startsWith('/login') ||
                          window.location.pathname.startsWith('/signup')

      if (!isPublicPage) {
        this.initializeAuthSubscription()
      }
    } else {
      // Server-side: defer initialization
      this.deferredInit = true
    }
  }

  private deferredInit = false

  public static getInstance(): RealtimeService {
    if (!RealtimeService.instance) {
      RealtimeService.instance = new RealtimeService()
    }
    return RealtimeService.instance
  }

  // Auth subscription methods
  private initializeAuthSubscription(): void {
    if (this.authSubscription) return


    const { data: { subscription } } = this.supabase.auth.onAuthStateChange(
      (event, session) => {

        // Notify all registered listeners
        this.authListeners.forEach(listener => {
          try {
            listener(event, session)
          } catch (error) {
          }
        })
      }
    )

    this.authSubscription = subscription
  }

  public addAuthListener(listener: AuthListener): () => void {
    // Check if we're on a public page and should skip auth
    if (typeof window !== 'undefined') {
      const isPublicPage = window.location.pathname.startsWith('/tools/') ||
                          window.location.pathname === '/' ||
                          window.location.pathname.startsWith('/login') ||
                          window.location.pathname.startsWith('/signup')

      if (isPublicPage) {
        // Return no-op cleanup function
        return () => {}
      }
    }

    // Initialize auth subscription if deferred
    if (this.deferredInit && !this.authSubscription) {
      this.initializeAuthSubscription()
      this.deferredInit = false
    }

    this.authListeners.add(listener)


    // Return cleanup function
    return () => {
      this.authListeners.delete(listener)

      // Clean up subscription if no listeners remain
      if (this.authListeners.size === 0) {
        this.cleanupAuthSubscription()
      }
    }
  }

  private cleanupAuthSubscription(): void {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe()
      this.authSubscription = null
    }
  }

  // Database subscription methods
  public addDatabaseListener(
    subscription: DatabaseSubscription
  ): () => void {
    const key = `${subscription.table}-${subscription.event}-${subscription.filter || 'all'}`

    // Add listener to the set
    if (!this.databaseListeners.has(key)) {
      this.databaseListeners.set(key, new Set())
    }
    this.databaseListeners.get(key)!.add(subscription.callback)

    // Create subscription if it doesn't exist
    if (!this.databaseSubscriptions.has(key)) {
      this.createDatabaseSubscription(key, subscription)
    }


    // Return cleanup function
    return () => {
      const listeners = this.databaseListeners.get(key)
      if (listeners) {
        listeners.delete(subscription.callback)

        // Clean up subscription if no listeners remain
        if (listeners.size === 0) {
          this.cleanupDatabaseSubscription(key)
        }
      }
    }
  }

  private createDatabaseSubscription(key: string, subscription: DatabaseSubscription): void {

    const channel = this.supabase.channel(`shared-${key}`)

    const config: any = {
      event: subscription.event,
      schema: 'public',
      table: subscription.table
    }

    if (subscription.filter) {
      config.filter = subscription.filter
    }

    channel.on('postgres_changes', config, (payload) => {
      const listeners = this.databaseListeners.get(key)
      if (listeners) {
        listeners.forEach(listener => {
          try {
            listener(payload)
          } catch (error) {
          }
        })
      }
    })

    const channelSubscription = channel.subscribe()
    this.databaseSubscriptions.set(key, channelSubscription)
  }

  private cleanupDatabaseSubscription(key: string): void {
    const subscription = this.databaseSubscriptions.get(key)
    if (subscription) {
      subscription.unsubscribe()
      this.databaseSubscriptions.delete(key)
      this.databaseListeners.delete(key)
    }
  }

  // Utility methods
  public getActiveSubscriptions(): {
    authListeners: number
    databaseSubscriptions: string[]
  } {
    return {
      authListeners: this.authListeners.size,
      databaseSubscriptions: Array.from(this.databaseSubscriptions.keys())
    }
  }

  public cleanup(): void {

    // Cleanup auth subscription
    this.cleanupAuthSubscription()
    this.authListeners.clear()

    // Cleanup database subscriptions
    this.databaseSubscriptions.forEach((subscription, key) => {
      subscription.unsubscribe()
    })
    this.databaseSubscriptions.clear()
    this.databaseListeners.clear()
  }
}

// Export singleton instance
export const realtimeService = RealtimeService.getInstance()

// Export types for consumers
export type { AuthListener, DatabaseListener, DatabaseSubscription }