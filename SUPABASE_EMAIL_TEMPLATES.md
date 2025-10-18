# Supabase Email Templates

## Signup Confirmation Email

**Location**: Supabase Dashboard → Authentication → Email Templates → Confirmation Email

**Template Name**: Confirmation Email (for signup)

**Magic Fields Used**:
- `{{ .SiteURL }}` - Base URL of your site
- `{{ .TokenHash }}` - Email verification token

**HTML Template**:

```html
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to Pathology Bites - Confirm Your Email Address</title>
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
      Please confirm your email address to access Pathology Bites
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
                  Confirm Your Email
                </h1>
                <p style="margin: 0 0 25px; font-size: 16px; line-height: 26px; color: #6b7280;">
                  Thank you for signing up with Pathology Bites! Please confirm your email address to complete your registration and start your learning journey.
                </p>
                <p style="margin: 0 0 35px; font-size: 16px; line-height: 26px; color: #6b7280;">
                  Please click the button below to verify your account.
                </p>
                
                <!-- Button : BEGIN -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin: auto;">
                  <tr>
                    <td style="border-radius: 6px; background: #5BA4A4; text-align: center;">
                      <a href="{{ .SiteURL }}/api/public/auth/confirm?token_hash={{ .TokenHash }}&type=signup" 
                         role="button" 
                         aria-label="Confirm your email address"
                         style="background: #5BA4A4; border: 12px solid #5BA4A4; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 16px; line-height: 1; text-align: center; text-decoration: none; display: block; border-radius: 6px; font-weight: 500; color: #ffffff;">
                        Confirm My Email
                      </a>
                    </td>
                  </tr>
                </table>
                <!-- Button : END -->
                
                <p style="margin: 35px 0 15px; font-size: 16px; line-height: 26px; color: #6b7280;">
                  If the button above doesn't work, copy and paste this link into your browser:
                </p>
                <p style="margin: 0 0 0px; font-size: 14px; line-height: 20px; word-break: break-all;">
                  <a href="{{ .SiteURL }}/api/public/auth/confirm?token_hash={{ .TokenHash }}&type=signup" 
                     class="fallback-link" 
                     style="color: #5BA4A4; text-decoration: underline;">
                    {{ .SiteURL }}/api/public/auth/confirm?token_hash={{ .TokenHash }}&type=signup
                  </a>
                </p>
                
              </td>
            </tr>
            <tr>
              <td style="padding: 25px 40px 40px; text-align: center; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 20px; color: #5BA4A4;">
                <p style="margin: 0;">
                  This confirmation link will expire in 24 hours. If you didn't create an account with Pathology Bites, please disregard this email.
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
```

---

## Recovery/Reauthentication Email

**Location**: Supabase Dashboard → Authentication → Email Templates → Recovery Email

**Template Name**: Recovery Email (for password reset, email changes, etc.)

**Magic Fields Used**:
- `{{ .SiteURL }}` - Base URL of your site
- `{{ .Token }}` - Recovery token

**HTML Template**:

```html
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify Your Identity - Pathology Bites</title>
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
      Verify your identity to continue using Pathology Bites
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
                  Verify Your Identity
                </h1>
                <p style="margin: 0 0 25px; font-size: 16px; line-height: 26px; color: #6b7280;">
                  We received a request to verify your identity for your Pathology Bites account. Please confirm this action by clicking the button below.
                </p>
                <p style="margin: 0 0 35px; font-size: 16px; line-height: 26px; color: #6b7280;">
                  If you didn't make this request, you can safely ignore this email.
                </p>

                <!-- Button : BEGIN -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin: auto;">
                  <tr>
                    <td style="border-radius: 6px; background: #5BA4A4; text-align: center;">
                      <a href="{{ .SiteURL }}/api/public/auth/confirm?token_hash={{ .Token }}&type=recovery"
                         role="button"
                         aria-label="Verify your identity"
                         style="background: #5BA4A4; border: 12px solid #5BA4A4; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 16px; line-height: 1; text-align: center; text-decoration: none; display: block; border-radius: 6px; font-weight: 500; color: #ffffff;">
                        Verify Identity
                      </a>
                    </td>
                  </tr>
                </table>
                <!-- Button : END -->

                <p style="margin: 35px 0 15px; font-size: 16px; line-height: 26px; color: #6b7280;">
                  If the button above doesn't work, copy and paste this link into your browser:
                </p>
                <p style="margin: 0 0 0px; font-size: 14px; line-height: 20px; word-break: break-all;">
                  <a href="{{ .SiteURL }}/api/public/auth/confirm?token_hash={{ .Token }}&type=recovery"
                     class="fallback-link"
                     style="color: #5BA4A4; text-decoration: underline;">
                    {{ .SiteURL }}/api/public/auth/confirm?token_hash={{ .Token }}&type=recovery
                  </a>
                </p>

              </td>
            </tr>
            <tr>
              <td style="padding: 25px 40px 40px; text-align: center; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 20px; color: #5BA4A4;">
                <p style="margin: 0;">
                  This verification link will expire in 24 hours. If you didn't request this verification, please disregard this email.
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
```

---

## Password Reset Email

**Location**: Supabase Dashboard → Authentication → Email Templates → Password Reset Email

**Template Name**: Password Reset Email

**Magic Fields Used**:
- `{{ .ConfirmationURL }}` - Pre-built URL with code parameter for password reset

**HTML Template**:

```html
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
                  <img src="https://www.pathologybites.com/icons/favicon-32x32.png" width="24" height="24" alt="" style="display: block; border: 0;" />
                </td>
                <td style="text-align: center; color: #5BA4A4; font-size: 24px;">Pathology Bites</td>
                </tr>
                </table>
                <![endif]-->
                <!--[if !mso]><!-->
                <table role="presentation" border="0" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="padding-right: 8px; color: #5BA4A4;">
                      <img src="https://www.pathologybites.com/icons/favicon-32x32.png" width="24" height="24" alt="" style="display: inline-block; border: 0;" />
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
                  We received a request to reset your password for your Pathology Bites account. Click the button below to create a new password.
                </p>
                <p style="margin: 0 0 35px; font-size: 16px; line-height: 26px; color: #6b7280;">
                  If you didn't request this password reset, you can safely ignore this email.
                </p>

                <!-- Button : BEGIN -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin: auto;">
                  <tr>
                    <td style="border-radius: 6px; background: #5BA4A4; text-align: center;">
                      <a href="{{ .ConfirmationURL }}"
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
                  <a href="{{ .ConfirmationURL }}"
                     class="fallback-link"
                     style="color: #5BA4A4; text-decoration: underline;">
                    {{ .ConfirmationURL }}
                  </a>
                </p>

              </td>
            </tr>
            <tr>
              <td style="padding: 25px 40px 40px; text-align: center; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 20px; color: #5BA4A4;">
                <p style="margin: 0;">
                  This password reset link will expire in 15 minutes for security reasons. If you need a new link, you can request another reset on the login page.
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
```

---

## Implementation Notes

1. **Signup Confirmation**: Uses `{{ .TokenHash }}` with `type=signup`
2. **Recovery/Reauthentication**: Uses `{{ .Token }}` with `type=recovery`
3. **Password Reset**: Uses `{{ .ConfirmationURL }}` (pre-built URL with code parameter)
4. All emails use the same professional styling and branding
5. Fallback links are provided for email clients that don't render buttons properly
6. All emails are responsive and mobile-friendly

