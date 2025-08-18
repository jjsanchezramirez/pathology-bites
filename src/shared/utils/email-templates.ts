// Email template utilities for Pathology Bites
// Based on the professional template used for auth emails

interface EmailTemplateProps {
  title: string
  preheaderText: string
  content: string
  buttonText?: string
  buttonUrl?: string
  footerText?: string
}

export function createEmailTemplate({
  title,
  preheaderText,
  content,
  buttonText,
  buttonUrl,
  footerText
}: EmailTemplateProps): { html: string; text: string } {
  
  const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
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
<body bgcolor="#f0f4f8" width="100%" style="margin: 0; mso-line-height-rule: exactly; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <center style="width: 100%; background-color: #f0f4f8; text-align: left;">
    <!-- Visually Hidden Preheader Text -->
    <div style="display: none; font-size: 1px; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; mso-hide: all; font-family: sans-serif;">
      ${preheaderText}
    </div>
    
    <!-- Background with gradient effect similar to website -->
    <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-image: radial-gradient(circle at 30% 50%, rgba(56, 189, 248, 0.08), transparent 25%), radial-gradient(circle at 70% 50%, rgba(56, 189, 248, 0.08), transparent 25%), linear-gradient(to bottom, rgba(56, 189, 248, 0.05), transparent); z-index: -1;">
    </div>
    
    <!-- Email Body -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="600" style="margin: auto; background-color: transparent;" class="email-container">
      <!-- Logo Header -->
      <tr>
        <td style="padding: 30px 0; text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td align="center" style="font-size: 24px; font-weight: 500; color: #5BA4A4;">
                <!--[if !mso]><!-->
                <table role="presentation" border="0" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="padding-right: 8px; color: #5BA4A4;">
                      <img src="https://www.pathologybites.com/icons/favicon-32x32.png" width="24" height="24" style="display: inline-block; border: 0;" />
                    </td>
                    <td style="color: #5BA4A4; font-size: 24px; vertical-align: middle; background: linear-gradient(to right, #5BA4A4, rgba(91, 164, 164, 0.7)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; font-weight: bold;">Pathology Bites</td>
                  </tr>
                </table>
                <!--<![endif]-->
              </td>
            </tr>
          </table>
        </td>
      </tr>
      
      <!-- White Card -->
      <tr>
        <td style="padding: 0 20px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" bgcolor="#ffffff" width="100%" style="border-radius: 12px; box-shadow: 0 0 2px rgba(0, 0, 0, 0.15);" class="no-shadow-mobile">
            <tr>
              <td style="padding: 40px 40px 25px; text-align: center; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                <h1 style="margin: 0 0 20px; font-size: 32px; line-height: 38px; font-weight: 700; color: #000000;">
                  ${title}
                </h1>
                <div style="margin: 0 0 25px; font-size: 16px; line-height: 26px; color: #6b7280; text-align: left;">
                  ${content}
                </div>
                
                ${buttonText && buttonUrl ? `
                <!-- Button : BEGIN -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin: auto;">
                  <tr>
                    <td style="border-radius: 6px; background: #5BA4A4; text-align: center;">
                      <a href="${buttonUrl}" 
                         role="button" 
                         style="background: #5BA4A4; border: 12px solid #5BA4A4; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 16px; line-height: 1; text-align: center; text-decoration: none; display: block; border-radius: 6px; font-weight: 500; color: #ffffff;">
                        ${buttonText}
                      </a>
                    </td>
                  </tr>
                </table>
                <!-- Button : END -->
                ` : ''}
                
              </td>
            </tr>
            ${footerText ? `
            <tr>
              <td style="padding: 25px 40px 40px; text-align: center; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 20px; color: #5BA4A4;">
                <p style="margin: 0;">
                  ${footerText}
                </p>
              </td>
            </tr>
            ` : ''}
          </table>
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
</html>`

  // Create plain text version
  const text = `
${title}

${content.replace(/<[^>]*>/g, '').replace(/\n\s*\n/g, '\n\n')}

${buttonText && buttonUrl ? `${buttonText}: ${buttonUrl}\n\n` : ''}

${footerText || ''}

---
Pathology Bites
https://pathologybites.com
  `.trim()

  return { html, text }
}

// Contact form notification email (sent to admin)
export function createContactNotificationEmail(data: {
  firstName: string
  lastName: string
  email: string
  organization?: string
  requestType: string
  inquiry: string
}) {
  const content = `
    <p style="margin: 0 0 20px; font-size: 16px; line-height: 26px; color: #6b7280;">
      You have received a new ${data.requestType === 'general' ? 'general inquiry' : 'technical support request'} through the Pathology Bites contact form.
    </p>

    <div style="background-color: #f5f5f5; padding: 20px; border-radius: 12px; margin: 20px 0;">
      <p style="margin: 0 0 8px; font-size: 13px; color: #6b7280;"><strong>Name:</strong> ${data.firstName} ${data.lastName}</p>
      <p style="margin: 0 0 8px; font-size: 13px; color: #6b7280;"><strong>Email:</strong> ${data.email}</p>
      ${data.organization ? `<p style="margin: 0 0 8px; font-size: 13px; color: #6b7280;"><strong>Organization:</strong> ${data.organization}</p>` : ''}
      <p style="margin: 0 0 16px; font-size: 13px; color: #6b7280;"><strong>Request Type:</strong> ${data.requestType === 'general' ? 'General Inquiry' : 'Technical Support'}</p>

      <div style="border-top: 1px solid #e5e7eb; padding-top: 16px;">
        <p style="margin: 0; font-size: 13px; line-height: 20px; color: #374151; white-space: pre-wrap;">${data.inquiry}</p>
      </div>
    </div>

    <p style="margin: 20px 0 0; font-size: 14px; line-height: 20px; color: #6b7280;">
      You can respond to this inquiry directly from the admin panel or by replying to this email.
    </p>
  `

  return createEmailTemplate({
    title: 'New Contact Form Submission',
    preheaderText: `New ${data.requestType} inquiry from ${data.firstName} ${data.lastName}`,
    content,
    buttonText: 'View in Admin Panel',
    buttonUrl: 'https://pathologybites.com/admin/inquiries',
    footerText: 'This notification was sent because you are an administrator of Pathology Bites.'
  })
}

// Admin response email (sent to user)
export function createAdminResponseEmail(data: {
  firstName: string
  lastName: string
  requestType: string
  originalInquiry: string
  response: string
}) {
  const content = `
    <p style="margin: 0 0 20px; font-size: 16px; line-height: 26px; color: #6b7280;">
      Dear ${data.firstName} ${data.lastName},
    </p>

    <p style="margin: 0 0 25px; font-size: 16px; line-height: 26px; color: #6b7280;">
      Thank you for contacting Pathology Bites. We've reviewed your ${data.requestType === 'general' ? 'inquiry' : 'technical support request'} and have a response for you.
    </p>

    <div style="margin: 25px 0; padding: 20px 0; border-top: 2px solid #5BA4A4; border-bottom: 1px solid #e5e7eb;">
      <div style="margin: 0; font-size: 16px; line-height: 26px; color: #1f2937; font-weight: 500; white-space: pre-wrap;">${data.response}</div>
    </div>

    <div style="background-color: #f5f5f5; padding: 16px; border-radius: 12px; margin: 25px 0;">
      <p style="margin: 0; font-size: 13px; line-height: 20px; color: #6b7280; white-space: pre-wrap;"><strong>Your original message:</strong><br><br>${data.originalInquiry}</p>
    </div>

    <p style="margin: 25px 0 0; font-size: 16px; line-height: 26px; color: #6b7280;">
      If you have any follow-up questions, please don't hesitate to reach out to us again.
    </p>

    <p style="margin: 20px 0 0; font-size: 16px; line-height: 26px; color: #6b7280;">
      Best regards,<br>
      <strong>The Pathology Bites Team</strong>
    </p>
  `

  return createEmailTemplate({
    title: `Re: Your ${data.requestType === 'general' ? 'General' : 'Technical Support'} Inquiry`,
    preheaderText: `Response to your inquiry from the Pathology Bites team`,
    content,
    buttonText: 'Visit Pathology Bites',
    buttonUrl: 'https://pathologybites.com',
    footerText: 'Thank you for using Pathology Bites. We\'re here to support your pathology learning journey.'
  })
}
