// src/shared/utils/performance-monitor.ts
// Performance monitoring utility to track optimization improvements

interface PerformanceMetric {
  name: string
  startTime: number
  endTime?: number
  duration?: number
  metadata?: Record<string, any>
}

class PerformanceMonitor {
  private static instance: PerformanceMonitor
  private metrics: Map<string, PerformanceMetric> = new Map()
  private isEnabled: boolean = process.env.NODE_ENV === 'development'

  private constructor() {}

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor()
    }
    return PerformanceMonitor.instance
  }

  // Start timing a metric
  public start(name: string, metadata?: Record<string, any>): void {
    if (!this.isEnabled) return

    this.metrics.set(name, {
      name,
      startTime: performance.now(),
      metadata
    })
  }

  // End timing a metric
  public end(name: string): number | null {
    if (!this.isEnabled) return null

    const metric = this.metrics.get(name)
    if (!metric) {
      console.warn(`Performance metric '${name}' not found`)
      return null
    }

    const endTime = performance.now()
    const duration = endTime - metric.startTime

    metric.endTime = endTime
    metric.duration = duration

    console.log(`⏱️ Performance: ${name} took ${duration.toFixed(2)}ms`, metric.metadata)

    return duration
  }

  // Log cache performance
  public logCacheHit(key: string, source: 'memory' | 'localStorage' | 'sessionStorage'): void {
    if (!this.isEnabled) return
    console.log(`💾 Cache HIT: ${key} (${source})`)
  }

  public logCacheMiss(key: string): void {
    if (!this.isEnabled) return
    console.log(`❌ Cache MISS: ${key}`)
  }

  // Log realtime subscription metrics
  public logRealtimeSubscription(action: 'add' | 'remove', type: 'auth' | 'database', key?: string): void {
    if (!this.isEnabled) return
    const message = key ? `${type}:${key}` : type
    console.log(`📡 Realtime ${action.toUpperCase()}: ${message}`)
  }

  // Log network optimization metrics
  public logNetworkOptimization(metric: string, value: number, unit: string): void {
    if (!this.isEnabled) return
    console.log(`🌐 Network: ${metric} = ${value}${unit}`)
  }

  // Get performance summary
  public getSummary(): {
    totalMetrics: number
    averageDuration: number
    slowestMetric: PerformanceMetric | null
    fastestMetric: PerformanceMetric | null
  } {
    const completedMetrics = Array.from(this.metrics.values()).filter(m => m.duration !== undefined)

    if (completedMetrics.length === 0) {
      return {
        totalMetrics: 0,
        averageDuration: 0,
        slowestMetric: null,
        fastestMetric: null
      }
    }

    const durations = completedMetrics.map(m => m.duration!)
    const averageDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length

    const slowestMetric = completedMetrics.reduce((slowest, current) =>
      (current.duration! > slowest.duration!) ? current : slowest
    )

    const fastestMetric = completedMetrics.reduce((fastest, current) =>
      (current.duration! < fastest.duration!) ? current : fastest
    )

    return {
      totalMetrics: completedMetrics.length,
      averageDuration,
      slowestMetric,
      fastestMetric
    }
  }

  // Clear all metrics
  public clear(): void {
    this.metrics.clear()
  }

  // Enable/disable monitoring
  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled
  }
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance()

// Convenience functions
export const startTimer = (name: string, metadata?: Record<string, any>) =>
  performanceMonitor.start(name, metadata)

export const endTimer = (name: string) =>
  performanceMonitor.end(name)

export const logCacheHit = (key: string, source: 'memory' | 'localStorage' | 'sessionStorage') =>
  performanceMonitor.logCacheHit(key, source)

export const logCacheMiss = (key: string) =>
  performanceMonitor.logCacheMiss(key)