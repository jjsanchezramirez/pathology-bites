// src/lib/services/security-service.ts
import { createServerSupabase } from '@/lib/supabase/server'

// Define threshold for suspicious activity
const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_PERIOD_MINUTES = 30

export async function trackLoginAttempt(
  email: string, 
  ipAddress: string, 
  success: boolean
) {
  const supabase = await createServerSupabase()
  
  try {
    // Record the login attempt
    await supabase
      .from('login_attempts')
      .insert({
        email,
        ip_address: ipAddress,
        success,
        timestamp: new Date().toISOString()
      })
      
    // If successful, no need to check for suspicious activity
    if (success) return { suspicious: false }
    
    // Check for multiple failed attempts from this IP
    const { data: failedAttempts } = await supabase
      .from('login_attempts')
      .select('*')
      .eq('ip_address', ipAddress)
      .eq('success', false)
      .gte('timestamp', new Date(Date.now() - (LOCKOUT_PERIOD_MINUTES * 60 * 1000)).toISOString())
      
    // If too many failed attempts, mark as suspicious
    if (failedAttempts && failedAttempts.length >= MAX_FAILED_ATTEMPTS) {
      await supabase
        .from('suspicious_ips')
        .insert({
          ip_address: ipAddress,
          reason: 'Too many failed login attempts',
          created_at: new Date().toISOString()
        })
        .onConflict('ip_address')
        .ignore()
        
      return { suspicious: true }
    }
    
    return { suspicious: false }
  } catch (error) {
    console.error('Error tracking login attempt:', error)
    return { suspicious: false }
  }
}

export async function isIPSuspicious(ipAddress: string) {
  const supabase = await createServerSupabase()
  
  try {
    // Check if IP is in suspicious list
    const { data } = await supabase
      .from('suspicious_ips')
      .select('*')
      .eq('ip_address', ipAddress)
      .single()
      
    return !!data
  } catch (error) {
    console.error('Error checking suspicious IP:', error)
    return false
  }
}