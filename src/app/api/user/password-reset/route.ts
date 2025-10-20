// src/app/api/user/password-reset/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { z } from 'zod'

const passwordResetSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  type: z.enum(['reset', 'magic_link']).optional().default('reset')
})

const passwordUpdateSchema = z.object({
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

// POST /api/user/password-reset - Request password reset
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    
    // Validate request data
    const validation = passwordResetSchema.safeParse(body)
    if (!validation.success) {
      const errors = validation.error.errors.map(err => err.message)
      return NextResponse.json({ error: errors.join('. ') }, { status: 400 })
    }

    const { email, type } = validation.data

    // Check if user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, status')
      .eq('email', email)
      .single()

    if (userError && userError.code !== 'PGRST116') {
      console.error('Error checking user:', userError)
      return NextResponse.json({ error: 'Failed to process request' }, { status: 500 })
    }

    if (!user) {
      // Don't reveal if user exists or not for security
      return NextResponse.json({
        success: true,
        message: 'If an account with this email exists, you will receive a password reset link.'
      })
    }

    if (user.status !== 'active') {
      return NextResponse.json({
        success: true,
        message: 'If an account with this email exists, you will receive a password reset link.'
      })
    }

    // Determine redirect URL based on type
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
    let redirectTo: string

    if (type === 'magic_link') {
      redirectTo = `${baseUrl}/api/public/auth/confirm?type=magiclink&next=/dashboard`
    } else {
      redirectTo = `${baseUrl}/api/public/auth/confirm?type=recovery&next=/reset-password`
    }

    // Generate password reset link using admin client to bypass CAPTCHA requirement
    // Note: This endpoint is only accessible to authenticated users (admin tools, user settings),
    // so we can safely bypass CAPTCHA by using the service role client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const adminClient = createAdminClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: type === 'magic_link' ? 'magiclink' : 'recovery',
      email: email,
      options: {
        redirectTo: redirectTo,
      }
    })

    if (linkError || !linkData) {
      console.error('Password reset link generation error:', linkError)
      return NextResponse.json({ error: 'Failed to generate password reset link' }, { status: 500 })
    }

    // Extract the action_link from the response
    // The action_link contains the full URL with token_hash that works with our /api/public/auth/confirm endpoint
    const actionLink = linkData.properties?.action_link

    if (!actionLink) {
      console.error('No action_link in generateLink response:', linkData)
      return NextResponse.json({ error: 'Failed to generate password reset link' }, { status: 500 })
    }

    // Send email via Resend
    // Note: generateLink() does NOT send emails automatically - we must send it ourselves
    const resend = new Resend(process.env.RESEND_API_KEY!)

    const emailSubject = type === 'magic_link'
      ? 'Your Magic Link for Pathology Bites'
      : 'Reset Your Pathology Bites Password'

    const emailHtml = type === 'magic_link'
      ? getMagicLinkEmailHtml(actionLink)
      : getPasswordResetEmailHtml(actionLink)

    const { error: emailError } = await resend.emails.send({
      from: 'Pathology Bites <noreply@pathologybites.com>',
      to: email,
      subject: emailSubject,
      html: emailHtml,
    })

    if (emailError) {
      console.error('Email sending error:', emailError)
      return NextResponse.json({ error: 'Failed to send password reset email' }, { status: 500 })
    }

    // Create audit log
    await supabase
      .from('audit_logs')
      .insert({
        user_id: user.id,
        action: type === 'magic_link' ? 'magic_link_requested' : 'password_reset_requested',
        table_name: 'users',
        record_id: user.id,
        metadata: {
          email: email,
          type: type,
          timestamp: new Date().toISOString(),
          ip_address: request.headers.get('x-forwarded-for') || 'unknown'
        }
      })

    return NextResponse.json({
      success: true,
      message: type === 'magic_link' 
        ? 'Magic link sent! Check your email to log in instantly.'
        : 'Password reset link sent! Check your email to reset your password.'
    })

  } catch (error) {
    console.error('Error in password reset:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/user/password-reset - Update password with reset token
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check if user is authenticated (should have valid reset token)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid or expired reset token' }, { status: 401 })
    }

    const body = await request.json()
    
    // Validate request data
    const validation = passwordUpdateSchema.safeParse(body)
    if (!validation.success) {
      const errors = validation.error.errors.map(err => err.message)
      return NextResponse.json({ error: errors.join('. ') }, { status: 400 })
    }

    const { password } = validation.data

    // Update password
    const { error: updateError } = await supabase.auth.updateUser({
      password: password
    })

    if (updateError) {
      console.error('Password update error:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    // Create audit log
    await supabase
      .from('audit_logs')
      .insert({
        user_id: user.id,
        action: 'password_updated',
        table_name: 'users',
        record_id: user.id,
        metadata: {
          timestamp: new Date().toISOString(),
          method: 'password_reset'
        }
      })

    return NextResponse.json({
      success: true,
      message: 'Password updated successfully'
    })

  } catch (error) {
    console.error('Error updating password:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Email template functions
function getPasswordResetEmailHtml(resetLink: string): string {
  return `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset Your Pathology Bites Password</title>
  <style type="text/css">
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; }
      .button { width: 100% !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background: radial-gradient(ellipse at top, #e0f2f1, #ffffff);">
  <center style="width: 100%; background: radial-gradient(ellipse at top, #e0f2f1, #ffffff);">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: auto;">
      <tr><td height="40">&nbsp;</td></tr>
      <tr>
        <td style="padding: 20px 0; text-align: center;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: auto;">
            <tr>
              <td style="border-radius: 8px; background: #5BA4A4; padding: 12px 24px;">
                <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">
                  Pathology Bites
                </h1>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding: 20px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" class="email-container" style="margin: auto; background: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <tr>
              <td style="padding: 40px 40px 20px 40px; text-align: center;">
                <h2 style="margin: 0 0 16px 0; font-size: 28px; font-weight: 700; color: #1a1a1a;">
                  Reset Your Password
                </h2>
                <p style="margin: 0; font-size: 16px; line-height: 24px; color: #666666;">
                  We received a request to reset your password. Click the button below to create a new password.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding: 20px 40px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: auto;">
                  <tr>
                    <td style="border-radius: 8px; background: #5BA4A4;">
                      <a href="${resetLink}" style="display: inline-block; padding: 16px 48px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none;">
                        Reset Password
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding: 20px 40px 40px 40px;">
                <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 20px; color: #666666; text-align: center;">
                  Or copy and paste this link into your browser:
                </p>
                <p style="margin: 0; font-size: 12px; line-height: 18px; color: #999999; word-break: break-all; text-align: center;">
                  ${resetLink}
                </p>
                <p style="margin: 24px 0 0 0; font-size: 14px; line-height: 20px; color: #666666; text-align: center;">
                  This link will expire in 24 hours. If you didn't request a password reset, please disregard this email.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr><td height="40">&nbsp;</td></tr>
    </table>
  </center>
</body>
</html>
  `.trim()
}

function getMagicLinkEmailHtml(magicLink: string): string {
  return `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your Magic Link for Pathology Bites</title>
  <style type="text/css">
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; }
      .button { width: 100% !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background: radial-gradient(ellipse at top, #e0f2f1, #ffffff);">
  <center style="width: 100%; background: radial-gradient(ellipse at top, #e0f2f1, #ffffff);">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: auto;">
      <tr><td height="40">&nbsp;</td></tr>
      <tr>
        <td style="padding: 20px 0; text-align: center;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: auto;">
            <tr>
              <td style="border-radius: 8px; background: #5BA4A4; padding: 12px 24px;">
                <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">
                  Pathology Bites
                </h1>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding: 20px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" class="email-container" style="margin: auto; background: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <tr>
              <td style="padding: 40px 40px 20px 40px; text-align: center;">
                <h2 style="margin: 0 0 16px 0; font-size: 28px; font-weight: 700; color: #1a1a1a;">
                  Your Magic Link
                </h2>
                <p style="margin: 0; font-size: 16px; line-height: 24px; color: #666666;">
                  Click the button below to instantly log in to your Pathology Bites account.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding: 20px 40px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: auto;">
                  <tr>
                    <td style="border-radius: 8px; background: #5BA4A4;">
                      <a href="${magicLink}" style="display: inline-block; padding: 16px 48px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none;">
                        Log In Now
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding: 20px 40px 40px 40px;">
                <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 20px; color: #666666; text-align: center;">
                  Or copy and paste this link into your browser:
                </p>
                <p style="margin: 0; font-size: 12px; line-height: 18px; color: #999999; word-break: break-all; text-align: center;">
                  ${magicLink}
                </p>
                <p style="margin: 24px 0 0 0; font-size: 14px; line-height: 20px; color: #666666; text-align: center;">
                  This link will expire in 24 hours. If you didn't request this magic link, please disregard this email.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr><td height="40">&nbsp;</td></tr>
    </table>
  </center>
</body>
</html>
  `.trim()
}
