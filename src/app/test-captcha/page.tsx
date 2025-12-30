// Test page to verify CAPTCHA environment variable and functionality
"use client"

import { useState } from 'react'
import { Turnstile } from '@marsidev/react-turnstile'

export default function TestCaptchaPage() {
  const [token, setToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITEKEY

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 space-y-6">
        <h1 className="text-2xl font-bold text-center">CAPTCHA Test Page</h1>

        <div className="space-y-4">
          <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded">
            <p className="text-sm font-semibold mb-2">Environment Variable Status:</p>
            <pre className="text-xs overflow-x-auto">
              {JSON.stringify({
                siteKey: siteKey || 'NOT SET',
                isConfigured: !!siteKey
              }, null, 2)}
            </pre>
          </div>

          {siteKey ? (
            <div className="space-y-4">
              <div className="flex justify-center">
                <Turnstile
                  siteKey={siteKey}
                  options={{
                    theme: 'light',
                    size: 'normal',
                  }}
                  onSuccess={(token) => {
                    setToken(token)
                    setError(null)
                    console.log('[TestPage] CAPTCHA Success:', {
                      token: token.substring(0, 50) + '...',
                      timestamp: new Date().toISOString()
                    })
                  }}
                  onError={(error) => {
                    const errorMsg = error || 'CAPTCHA verification failed'
                    setError(errorMsg)
                    setToken(null)
                    console.error('[TestPage] CAPTCHA Error:', {
                      error: errorMsg,
                      timestamp: new Date().toISOString(),
                      siteKey
                    })
                  }}
                  onExpire={() => {
                    setToken(null)
                    setError('CAPTCHA expired')
                    console.log('[TestPage] CAPTCHA Expired:', new Date().toISOString())
                  }}
                  onBeforeInteractive={() => {
                    console.log('[TestPage] CAPTCHA Before Interactive:', new Date().toISOString())
                  }}
                  onAfterInteractive={() => {
                    console.log('[TestPage] CAPTCHA After Interactive:', new Date().toISOString())
                  }}
                />
              </div>

              {token && (
                <div className="bg-green-100 dark:bg-green-900 p-4 rounded">
                  <p className="text-sm font-semibold text-green-800 dark:text-green-200 mb-2">
                    ✅ CAPTCHA Success!
                  </p>
                  <p className="text-xs text-green-700 dark:text-green-300 break-all">
                    Token: {token.substring(0, 50)}...
                  </p>
                </div>
              )}

              {error && (
                <div className="bg-red-100 dark:bg-red-900 p-4 rounded">
                  <p className="text-sm font-semibold text-red-800 dark:text-red-200">
                    ❌ CAPTCHA Error
                  </p>
                  <p className="text-xs text-red-700 dark:text-red-300">
                    {error}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-yellow-100 dark:bg-yellow-900 p-4 rounded">
              <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                ⚠️ CAPTCHA Not Configured
              </p>
              <p className="text-xs text-yellow-700 dark:text-yellow-300">
                Set NEXT_PUBLIC_TURNSTILE_SITEKEY in your .env.local file
              </p>
            </div>
          )}

          <div className="bg-blue-100 dark:bg-blue-900 p-4 rounded">
            <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">
              📝 Test Keys Available:
            </p>
            <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
              <li>• Always passes: 1x00000000000000000000AA</li>
              <li>• Always fails: 2x00000000000000000000AB</li>
              <li>• Interactive challenge: 3x00000000000000000000FF</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
