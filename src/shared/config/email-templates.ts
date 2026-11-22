// Email template utilities for Pathology Bites
// Based on the professional template used for auth emails

interface EmailTemplateProps {
  title: string;
  preheaderText: string;
  content: string;
  buttonText?: string;
  buttonUrl?: string;
  footerText?: string;
}

export function createEmailTemplate({
  title,
  preheaderText,
  content,
  buttonText,
  buttonUrl,
  footerText,
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
                
                ${
                  buttonText && buttonUrl
                    ? `
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
                `
                    : ""
                }
                
              </td>
            </tr>
            ${
              footerText
                ? `
            <tr>
              <td style="padding: 25px 40px 40px; text-align: center; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 20px; color: #5BA4A4;">
                <p style="margin: 0;">
                  ${footerText}
                </p>
              </td>
            </tr>
            `
                : ""
            }
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
</html>`;

  // Create plain text version
  const text = `
${title}

${content.replace(/<[^>]*>/g, "").replace(/\n\s*\n/g, "\n\n")}

${buttonText && buttonUrl ? `${buttonText}: ${buttonUrl}\n\n` : ""}

${footerText || ""}

---
Pathology Bites
https://pathologybites.com
  `.trim();

  return { html, text };
}

// Contact form notification email (sent to admin)
export function createContactNotificationEmail(data: {
  firstName: string;
  lastName: string;
  email: string;
  organization?: string;
  requestType: string;
  inquiry: string;
}) {
  const content = `
    <p style="margin: 0 0 20px; font-size: 16px; line-height: 26px; color: #6b7280;">
      You have received a new ${data.requestType === "general" ? "general inquiry" : "technical support request"} through the Pathology Bites contact form.
    </p>

    <div style="background-color: #f5f5f5; padding: 20px; border-radius: 12px; margin: 20px 0;">
      <p style="margin: 0 0 8px; font-size: 13px; color: #6b7280;"><strong>Name:</strong> ${data.firstName} ${data.lastName}</p>
      <p style="margin: 0 0 8px; font-size: 13px; color: #6b7280;"><strong>Email:</strong> ${data.email}</p>
      ${data.organization ? `<p style="margin: 0 0 8px; font-size: 13px; color: #6b7280;"><strong>Organization:</strong> ${data.organization}</p>` : ""}
      <p style="margin: 0 0 16px; font-size: 13px; color: #6b7280;"><strong>Request Type:</strong> ${data.requestType === "general" ? "General Inquiry" : "Technical Support"}</p>

      <div style="border-top: 1px solid #e5e7eb; padding-top: 16px;">
        <p style="margin: 0; font-size: 13px; line-height: 20px; color: #374151; white-space: pre-wrap;">${data.inquiry}</p>
      </div>
    </div>

    <p style="margin: 20px 0 0; font-size: 14px; line-height: 20px; color: #6b7280;">
      You can respond to this inquiry directly from the admin panel or by replying to this email.
    </p>
  `;

  return createEmailTemplate({
    title: "New Contact Form Submission",
    preheaderText: `New ${data.requestType} inquiry from ${data.firstName} ${data.lastName}`,
    content,
    buttonText: "View in Admin Panel",
    buttonUrl: "https://pathologybites.com/admin/inquiries",
    footerText: "This notification was sent because you are an administrator of Pathology Bites.",
  });
}

// Admin response email (sent to user)
export function createAdminResponseEmail(data: {
  firstName: string;
  lastName: string;
  requestType: string;
  originalInquiry: string;
  response: string;
}) {
  const content = `
    <p style="margin: 0 0 20px; font-size: 16px; line-height: 26px; color: #6b7280;">
      Dear ${data.firstName} ${data.lastName},
    </p>

    <p style="margin: 0 0 25px; font-size: 16px; line-height: 26px; color: #6b7280;">
      Thank you for contacting Pathology Bites. We've reviewed your ${data.requestType === "general" ? "inquiry" : "technical support request"} and have a response for you.
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
  `;

  return createEmailTemplate({
    title: `Re: Your ${data.requestType === "general" ? "General" : "Technical Support"} Inquiry`,
    preheaderText: `Response to your inquiry from the Pathology Bites team`,
    content,
    buttonText: "Visit Pathology Bites",
    buttonUrl: "https://pathologybites.com",
    footerText:
      "Thank you for using Pathology Bites. We're here to support your pathology learning journey.",
  });
}

// Waitlist announcement email template
interface WaitlistAnnouncementData {
  subject: string;
  message: string;
  buttonText?: string;
  buttonUrl?: string;
}

export function createWaitlistAnnouncementEmail(data: WaitlistAnnouncementData): {
  html: string;
  text: string;
} {
  const content = `
    <p style="margin: 0 0 20px; font-size: 16px; line-height: 26px; color: #374151;">
      Hello from the Pathology Bites team!
    </p>

    <div style="margin: 20px 0; padding: 20px; background-color: #f8fafc; border-radius: 8px; border-left: 4px solid #5BA4A4;">
      <p style="margin: 0; font-size: 16px; line-height: 26px; color: #374151; white-space: pre-wrap;">${data.message}</p>
    </div>

    <p style="margin: 20px 0 0; font-size: 16px; line-height: 26px; color: #6b7280;">
      Thank you for your patience and interest in Pathology Bites!<br>
      <strong>The Pathology Bites Team</strong>
    </p>
  `;

  return createEmailTemplate({
    title: data.subject,
    preheaderText: "Update from the Pathology Bites team",
    content,
    buttonText: data.buttonText,
    buttonUrl: data.buttonUrl,
    footerText:
      "You received this email because you signed up for our waitlist. If you no longer wish to receive updates, please contact us.",
  });
}

// Waitlist invite: "the doors are open, it's free, come in."
// One-off email that retired the launch waitlist. Sent 2026-11-22 to 108 waitlist
// addresses (registered users skipped) by dev/scripts/email/send-waitlist-invite.ts.
// Kept as a record of what went out, NOT as a model to copy: the owner did not like it.
// Verdict: too long, too cheesy (the gift/"unwrap it" framing), too generic. Next time:
// shorter, more to the point, distinctive, a handful of features rather than everything.
// Feature list mirrors the student dashboard nav (shared/config/navigation.ts) and the
// public tools in the footer (shared/components/layout/footer.tsx); update both together.
interface WaitlistInviteSection {
  emoji: string;
  heading: string;
  items: { name: string; desc: string; href: string }[];
}

const SITE = "https://www.pathologybites.com";

const WAITLIST_INVITE_SECTIONS: WaitlistInviteSection[] = [
  {
    emoji: "🔬",
    heading: "Practice like it's board day",
    items: [
      {
        name: "Custom quizzes",
        desc: "400+ board-style questions with images and explanations, built to whatever you choose: topics, length, timed or tutor mode.",
        href: `${SITE}/dashboard/quiz/new`,
      },
      {
        name: "Slide-based questions",
        desc: "Whole-slide images you pan and zoom yourself, then commit to a diagnosis.",
        href: `${SITE}/dashboard/wsi-questions`,
      },
      {
        name: "Bone marrow morphology quiz",
        desc: "Rapid-fire cell identification until you can tell a myelocyte from a metamyelocyte half asleep.",
        href: `${SITE}/tools/cell-quiz`,
      },
    ],
  },
  {
    emoji: "📚",
    heading: "Study smarter",
    items: [
      {
        name: "Learning modules",
        desc: "Short guided lessons for when you want to learn something properly.",
        href: `${SITE}/dashboard/learn`,
      },
      {
        name: "Ankoma deck viewer",
        desc: "The Ankoma pathology Anki deck, readable and searchable right in your browser.",
        href: `${SITE}/dashboard/anki`,
      },
      {
        name: "Study plan, progress and performance",
        desc: "A plan to follow, analytics that show where you're strong and where you're shaky, and achievements to unlock along the way.",
        href: `${SITE}/dashboard/study-plan`,
      },
    ],
  },
  {
    emoji: "🧭",
    heading: "Look anything up",
    items: [
      {
        name: "Virtual slide search engine",
        desc: "66,000+ whole-slide images from teaching collections worldwide, searchable by diagnosis.",
        href: `${SITE}/tools/virtual-slides`,
      },
      {
        name: "Histologic image library",
        desc: "A curated collection of pathology images.",
        href: `${SITE}/tools/images`,
      },
      {
        name: "IHC panel builder",
        desc: "Pick your differential and get the antibodies ranked by how well they tell them apart, with citations.",
        href: `${SITE}/tools/ihc`,
      },
    ],
  },
  {
    emoji: "🧰",
    heading: "Bench and sign-out helpers",
    items: [
      {
        name: "Differential cell counter",
        desc: "A customizable counter for peripheral smears and marrows.",
        href: `${SITE}/tools/cell-counter`,
      },
      {
        name: "MILAN and GENOVA",
        desc: "Gene and biomarker lookup, plus automated variant classification.",
        href: `${SITE}/tools/milan`,
      },
      {
        name: "Lupus anticoagulant calculator, ABPath content specs, citation manager and image converter",
        desc: "Small, well-made tools for the jobs nobody else bothered to make easier.",
        href: `${SITE}/tools/abpath`,
      },
    ],
  },
];

export function createWaitlistInviteEmail(): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = "Something wonderful has arrived for you 🎁";
  const signupUrl = `${SITE}/signup`;

  const p = (inner: string, extra = "") =>
    `<p style="margin: 0 0 18px; font-size: 16px; line-height: 26px; color: #374151;${extra}">${inner}</p>`;

  const sectionsHtml = WAITLIST_INVITE_SECTIONS.map(
    (section) => `
    <div style="margin: 0 0 22px;">
      <p style="margin: 0 0 10px; font-size: 17px; line-height: 24px; font-weight: 700; color: #111827;">
        <span style="font-size: 18px;">${section.emoji}</span>&nbsp; ${section.heading}
      </p>
      ${section.items
        .map(
          (item) => `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 0 0 10px;">
        <tr>
          <td width="14" valign="top" style="padding-top: 9px;">
            <div style="width: 6px; height: 6px; border-radius: 3px; background: #5BA4A4;"></div>
          </td>
          <td valign="top" style="font-size: 15px; line-height: 23px; color: #4b5563;">
            <a href="${item.href}" style="color: #2f7f7f; font-weight: 600; text-decoration: none;">${item.name}</a>: ${item.desc}
          </td>
        </tr>
      </table>`
        )
        .join("")}
    </div>`
  ).join("");

  const content = `
    ${p("Hello, friend of Pathology Bites,")}
    ${p(
      "A while back you put your name on a little list and asked us to tell you when the doors opened. We've been in the workshop ever since, wrapping something for you."
    )}
    ${p("It's ready. The doors are open, and it's yours.")}

    <div style="margin: 26px 0; padding: 20px 22px; background-color: #f0f8f8; border-radius: 12px; border: 1px dashed #5BA4A4; text-align: center;">
      <p style="margin: 0 0 6px; font-size: 20px; line-height: 28px; font-weight: 700; color: #1f5f5f;">
        Free. Completely, genuinely free.
      </p>
      <p style="margin: 0; font-size: 15px; line-height: 23px; color: #4b5563;">
        No trial, no paywall, no credit card. No biopsy required.
      </p>
    </div>

    ${p("Here's what's inside the box:", " font-weight: 600; color: #111827;")}

    ${sectionsHtml}

    ${p(
      "All of it is built by a pathologist, for residents, fellows, students and anyone else who loves looking down a microscope. Make an account, pour yourself a coffee and have a wander."
    )}
  `;

  const { html } = createEmailTemplate({
    title: "The doors are open! 🎉",
    preheaderText:
      "You asked us to tell you when Pathology Bites opened. It's open, and it's completely free.",
    content,
    buttonText: "Unwrap it: create your free account",
    buttonUrl: signupUrl,
    footerText:
      "You're getting this one-time note because you joined the Pathology Bites waitlist. We're retiring the waitlist now that everyone can sign up, so you won't hear from it again.",
  });

  const sectionsText = WAITLIST_INVITE_SECTIONS.map(
    (s) =>
      `${s.emoji} ${s.heading}\n` +
      s.items.map((i) => `  • ${i.name}: ${i.desc}\n    ${i.href}`).join("\n")
  ).join("\n\n");

  const text = `The doors are open!

Hello, friend of Pathology Bites,

A while back you put your name on a little list and asked us to tell you when the doors opened. We've been in the workshop ever since, wrapping something for you.

It's ready. The doors are open, and it's yours.

FREE. Completely, genuinely free. No trial, no paywall, no credit card. No biopsy required.

Here's what's inside the box:

${sectionsText}

All of it is built by a pathologist, for residents, fellows, students and anyone else who loves looking down a microscope. Make an account, pour yourself a coffee and have a wander.

Unwrap it (create your free account): ${signupUrl}

---
You're getting this one-time note because you joined the Pathology Bites waitlist. We're retiring the waitlist now that everyone can sign up, so you won't hear from it again.
Pathology Bites
${SITE}`;

  return { subject, html, text };
}
