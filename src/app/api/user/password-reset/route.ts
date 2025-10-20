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
      console.error('[Password Reset] Link generation error:', linkError)
      return NextResponse.json({ error: 'Failed to generate password reset link' }, { status: 500 })
    }

    console.log('[Password Reset] generateLink response:', JSON.stringify(linkData, null, 2))

    // Extract the hashed_token from the response and construct our own callback URL
    // Supabase's action_link goes directly to Supabase, but we want to use our callback endpoint
    const hashedToken = linkData.properties?.hashed_token

    if (!hashedToken) {
      console.error('[Password Reset] No hashed_token in generateLink response:', linkData)
      return NextResponse.json({ error: 'Failed to generate password reset link' }, { status: 500 })
    }

    // Construct the proper callback URL that goes through our app
    const actionLink = `${baseUrl}/api/public/auth/confirm?token_hash=${hashedToken}&type=${type === 'magic_link' ? 'magiclink' : 'recovery'}&next=${type === 'magic_link' ? '/dashboard' : '/reset-password'}`

    // Send email via Resend
    // Note: generateLink() does NOT send emails automatically - we must send it ourselves
    const resend = new Resend(process.env.RESEND_API_KEY!)

    const emailSubject = type === 'magic_link'
      ? 'Your Magic Link for Pathology Bites'
      : 'Reset Your Pathology Bites Password'

    const emailHtml = type === 'magic_link'
      ? getMagicLinkEmailHtml(actionLink)
      : getPasswordResetEmailHtml(actionLink)

    console.log('[Password Reset] Attempting to send email to:', email)
    console.log('[Password Reset] Email type:', type)
    console.log('[Password Reset] Action link generated:', actionLink)

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: 'Pathology Bites <noreply@pathologybites.com>',
      to: email,
      subject: emailSubject,
      html: emailHtml,
    })

    if (emailError) {
      console.error('[Password Reset] Email sending error:', emailError)
      return NextResponse.json({ error: 'Failed to send password reset email' }, { status: 500 })
    }

    console.log('[Password Reset] Email sent successfully. Email ID:', emailData?.id)

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
  <title>Reset Your Password - Pathology Bites</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td, h1, p, a {font-family: Arial, Helvetica, sans-serif !important;}
  </style>
  <![endif]-->
  <style type="text/css">
    /* CLIENT-SPECIFIC STYLES */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    table { border-collapse: collapse !important; }
    body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; }

    /* iOS BLUE LINKS */
    a[x-apple-data-detectors] {
      color: inherit !important;
      text-decoration: none !important;
      font-size: inherit !important;
      font-family: inherit !important;
      font-weight: inherit !important;
      line-height: inherit !important;
    }

    /* GMAIL/WEBMAIL STYLES */
    .ExternalClass { width: 100%; }
    .ExternalClass, .ExternalClass p, .ExternalClass span, .ExternalClass font, .ExternalClass td, .ExternalClass div { line-height: 100%; }

    /* FALLBACK LINK STYLES */
    .fallback-link {
      color: #5BA4A4 !important;
      text-decoration: underline !important;
      word-break: break-all;
    }

    /* MOBILE STYLES */
    @media screen and (max-width: 600px) {
      .email-container { width: 100% !important; }
      .fluid { max-width: 100% !important; height: auto !important; margin-left: auto !important; margin-right: auto !important; }
      .stack-column { display: block !important; width: 100% !important; max-width: 100% !important; direction: ltr !important; }
      h1 { font-size: 30px !important; line-height: 36px !important; }
      p { font-size: 16px !important; line-height: 24px !important; }
      .no-shadow-mobile { box-shadow: none !important; }
    }
  </style>
</head>
<body bgcolor="#f0f4f8" width="100%" style="margin: 0; mso-line-height-rule: exactly; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-image: radial-gradient(circle at 30% 50%, rgba(56, 189, 248, 0.08), transparent 25%), radial-gradient(circle at 70% 50%, rgba(56, 189, 248, 0.08), transparent 25%), linear-gradient(to bottom, rgba(56, 189, 248, 0.05), transparent);">
  <center style="width: 100%; background-color: #f0f4f8; text-align: left;">
    <!-- Visually Hidden Preheader Text -->
    <div style="display: none; font-size: 1px; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; mso-hide: all; font-family: sans-serif;">
      Reset your password for Pathology Bites
    </div>

    <!-- Email Body -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="600" style="margin: auto; background-color: transparent;" class="email-container">
      <!-- Logo Header -->
      <tr>
        <td style="padding: 30px 0; text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          <!--[if mso]>
          <table role="presentation" border="0" cellspacing="0" cellpadding="0" width="600">
          <tr>
          <td align="center" valign="top" width="600">
          <![endif]-->
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td align="center" style="font-size: 24px; font-weight: 500; color: #5BA4A4;">
                <!--[if mso]>
                <table role="presentation" border="0" cellspacing="0" cellpadding="0">
                <tr>
                <td width="30" style="text-align: center; padding-right: 10px; color: #5BA4A4; font-size: 22px;">
                  <img src="https://www.pathologybites.com/icons/favicon-32x32.png" width="24" height="24" style="display: block; border: 0;" />
                </td>
                <td style="text-align: center; color: #5BA4A4; font-size: 24px;">Pathology Bites</td>
                </tr>
                </table>
                <![endif]-->
                <!--[if !mso]><!-->
                <table role="presentation" border="0" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="padding-right: 8px; color: #5BA4A4;">
                      <img src="https://www.pathologybites.com/icons/favicon-32x32.png" width="24" height="24" style="display: inline-block; border: 0;" />
                    </td>
                    <td style="color: #5BA4A4; font-size: 24px; vertical-align: middle; font-weight: bold;">Pathology Bites</td>
                  </tr>
                </table>
                <!--<![endif]-->
              </td>
            </tr>
          </table>
          <!--[if mso]>
          </td>
          </tr>
          </table>
          <![endif]-->
        </td>
      </tr>

      <!-- White Card -->
      <tr>
        <td style="padding: 0 20px;">
          <!--[if mso]>
          <table role="presentation" border="0" cellspacing="0" cellpadding="0" width="560">
          <tr>
          <td width="560" bgcolor="#ffffff" style="border-radius: 12px;">
          <![endif]-->
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" bgcolor="#ffffff" width="100%" style="border-radius: 12px; box-shadow: 0 0 2px rgba(0, 0, 0, 0.15);" class="no-shadow-mobile">
            <tr>
              <td style="padding: 40px 40px 25px; text-align: center; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                <h1 style="margin: 0 0 20px; font-size: 32px; line-height: 38px; font-weight: 700; color: #000000;">
                  Reset Your Password
                </h1>
                <p style="margin: 0 0 25px; font-size: 16px; line-height: 26px; color: #6b7280;">
                  We received a request to reset the password for your Pathology Bites account. Click the button below to create a new password.
                </p>
                <p style="margin: 0 0 35px; font-size: 16px; line-height: 26px; color: #6b7280;">
                  If you didn't request this password reset, you can safely ignore this email.
                </p>

                <!-- Button : BEGIN -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin: auto;">
                  <tr>
                    <td style="border-radius: 6px; background: #5BA4A4; text-align: center;">
                      <a href="${resetLink}"
                         role="button"
                         aria-label="Reset your password"
                         style="background: #5BA4A4; border: 12px solid #5BA4A4; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 16px; line-height: 1; text-align: center; text-decoration: none; display: block; border-radius: 6px; font-weight: 500; color: #ffffff;">
                        Reset Password
                      </a>
                    </td>
                  </tr>
                </table>
                <!-- Button : END -->

                <p style="margin: 35px 0 15px; font-size: 16px; line-height: 26px; color: #6b7280;">
                  If the button above doesn't work, copy and paste this link into your browser:
                </p>
                <p style="margin: 0 0 0px; font-size: 14px; line-height: 20px; word-break: break-all;">
                  <a href="${resetLink}"
                     class="fallback-link"
                     style="color: #5BA4A4; text-decoration: underline;">
                    ${resetLink}
                  </a>
                </p>

              </td>
            </tr>
            <tr>
              <td style="padding: 25px 40px 40px; text-align: center; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 20px; color: #5BA4A4;">
                <p style="margin: 0;">
                  This password reset link will expire in 24 hours. If you didn't request this reset, please disregard this email.
                </p>
              </td>
            </tr>
          </table>
          <!--[if mso]>
          </td>
          </tr>
          </table>
          <![endif]-->
        </td>
      </tr>

      <!-- Spacer -->
      <tr>
        <td height="40">&nbsp;</td>
      </tr>

    </table>
    <!-- Email Body : END -->
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
