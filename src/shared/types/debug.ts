// src/shared/types/debug.ts
/**
 * Type definitions for the comprehensive debug panel
 */

// User role type definition
export type UserRole = 'admin' | 'creator' | 'reviewer' | 'user'

// Debug access levels
export type DebugAccessLevel = 'none' | 'read' | 'write' | 'admin'

// System management types
export interface SystemToggle {
  id: string
  name: string
  description: string
  enabled: boolean
  scope: 'global' | 'session'
  requiresRestart?: boolean
  dangerLevel: 'low' | 'medium' | 'high'
}

export interface MaintenanceMode {
  enabled: boolean
  message?: string
  allowedRoles: UserRole[]
  startTime?: string
  estimatedEndTime?: string
}

export interface ComingSoonMode {
  enabled: boolean
  launchDate?: string
  allowBypass: boolean
  bypassRoles: UserRole[]
}

// Environment variable management
export interface EnvVariable {
  key: string
  value: string
  type: 'string' | 'boolean' | 'number' | 'json'
  sensitive: boolean
  description?: string
  scope: 'global' | 'session'
  category: 'auth' | 'database' | 'features' | 'system' | 'external'
}

export interface EnvVariableUpdate {
  key: string
  value: string
  scope: 'global' | 'session'
}

// API Inspector types
export interface ApiEndpoint {
  path: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  description?: string
  requiresAuth: boolean
  requiredRole?: UserRole
  parameters?: ApiParameter[]
  responseSchema?: Record<string, unknown>
}

export interface ApiParameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  required: boolean
  description?: string
  example?: unknown
}

export interface ApiRequest {
  endpoint: ApiEndpoint
  headers: Record<string, string>
  body?: Record<string, unknown>
  queryParams?: Record<string, string>
}

export interface ApiResponse {
  status: number
  statusText: string
  headers: Record<string, string>
  body: any
  responseTime: number
  timestamp: string
}

export interface ApiTestResult {
  request: ApiRequest
  response: ApiResponse
  success: boolean
  error?: string
}

// State management types
export interface StateSnapshot {
  timestamp: string
  clientState: Record<string, any>
  serverState: Record<string, any>
  sessionData: Record<string, any>
  cookies: Record<string, string>
}

export interface StateUpdate {
  path: string
  value: any
  type: 'client' | 'server' | 'session'
}

// User impersonation types
export interface ImpersonationSession {
  originalUserId: string
  targetUserId: string
  targetUserEmail: string
  targetUserRole: UserRole
  startTime: string
  reason?: string
  active: boolean
}

export interface UserSearchResult {
  id: string
  email: string
  role: UserRole
  status: 'active' | 'inactive' | 'suspended'
  lastLogin?: string
  createdAt: string
}

// Simulation controls types
export interface ErrorSimulation {
  id: string
  name: string
  description: string
  statusCode: number
  message: string
  endpoints: string[]
  enabled: boolean
  probability: number // 0-100
}

export interface LatencySimulation {
  id: string
  name: string
  description: string
  delay: number // milliseconds
  endpoints: string[]
  enabled: boolean
  variance: number // percentage
}

export interface LocaleSimulation {
  locale: string
  timezone: string
  currency: string
  dateFormat: string
  enabled: boolean
}

// Data management types
export interface SeedScript {
  id: string
  name: string
  description: string
  category: 'users' | 'questions' | 'categories' | 'images' | 'all'
  estimatedTime: string
  dataSize: string
  destructive: boolean
}

export interface CacheLayer {
  id: string
  name: string
  description: string
  type: 'browser' | 'application' | 'cdn' | 'database'
  size?: string
  lastCleared?: string
}

// System information types
export interface SystemInfo {
  version: string
  gitCommit: string
  gitBranch: string
  buildTime: string
  nodeVersion: string
  nextVersion: string
  environment: string
  uptime: number
}

export interface LogEntry {
  timestamp: string
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  category: string
  metadata?: Record<string, any>
  userId?: string
  requestId?: string
}

export interface BusinessEvent {
  id: string
  timestamp: string
  type: string
  description: string
  userId?: string
  metadata: Record<string, any>
  severity: 'low' | 'medium' | 'high'
}

// Debug panel configuration
export interface DebugPanelConfig {
  accessLevel: DebugAccessLevel
  enabledFeatures: string[]
  refreshInterval: number
  maxLogEntries: number
  maxEventEntries: number
  autoRefresh: boolean
}

// Debug session types
export interface DebugSession {
  id: string
  userId: string
  userRole: UserRole
  accessLevel: DebugAccessLevel
  startTime: string
  lastActivity: string
  features: string[]
  impersonationActive: boolean
  simulationsActive: string[]
}

// Comprehensive debug panel state
export interface DebugPanelState {
  session: DebugSession
  config: DebugPanelConfig
  systemToggles: SystemToggle[]
  envVariables: EnvVariable[]
  apiEndpoints: ApiEndpoint[]
  stateSnapshot: StateSnapshot
  impersonationSession?: ImpersonationSession
  errorSimulations: ErrorSimulation[]
  latencySimulations: LatencySimulation[]
  localeSimulation: LocaleSimulation
  seedScripts: SeedScript[]
  cacheLayers: CacheLayer[]
  systemInfo: SystemInfo
  logs: LogEntry[]
  businessEvents: BusinessEvent[]
  simulationsActive: string[]
}

// API response types for debug endpoints
export interface DebugApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  timestamp: string
  requestId: string
}

// Debug panel action types
export type DebugAction = 
  | { type: 'TOGGLE_SYSTEM_SETTING'; payload: { id: string; enabled: boolean } }
  | { type: 'UPDATE_ENV_VARIABLE'; payload: EnvVariableUpdate }
  | { type: 'EXECUTE_API_REQUEST'; payload: ApiRequest }
  | { type: 'UPDATE_STATE'; payload: StateUpdate }
  | { type: 'START_IMPERSONATION'; payload: { userId: string; reason?: string } }
  | { type: 'STOP_IMPERSONATION' }
  | { type: 'TOGGLE_ERROR_SIMULATION'; payload: { id: string; enabled: boolean } }
  | { type: 'TOGGLE_LATENCY_SIMULATION'; payload: { id: string; enabled: boolean } }
  | { type: 'UPDATE_LOCALE_SIMULATION'; payload: LocaleSimulation }
  | { type: 'RUN_SEED_SCRIPT'; payload: { id: string } }
  | { type: 'CLEAR_CACHE'; payload: { id: string } }
  | { type: 'REFRESH_LOGS' }
  | { type: 'REFRESH_EVENTS' }
  | { type: 'UPDATE_CONFIG'; payload: Partial<DebugPanelConfig> }
