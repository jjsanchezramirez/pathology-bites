// src/app/api/admin/notify-verified-users/route.ts
// One-time endpoint to notify users whose emails were manually confirmed
// after the PKCE verification bug fix. Delete this file after use.

import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { createEmailTemplate } from "@/shared/config/email-templates";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createSupabaseClient(supabaseUrl, supabaseServiceKey);
}

export async function POST(request: NextRequest) {
  // Auth check — require admin role
  const userId = request.headers.get("x-user-id");
  const userRole = request.headers.get("x-user-role");

  if (!userId || userRole !== "admin") {
    return NextResponse.json(
      { error: userRole ? "Forbidden - Admin access required" : "Unauthorized" },
      { status: userRole ? 403 : 401 }
    );
  }

  if (!resend) {
    return NextResponse.json({ error: "Resend API key not configured" }, { status: 500 });
  }

  const supabase = createAdminClient();

  // Find users who were recently confirmed (manually via SQL)
  // These users have email_confirmed_at set but never signed in
  const { data: users, error: queryError } = await supabase
    .from("users")
    .select("id, email, first_name")
    .eq("status", "active");

  if (queryError) {
    console.error("Error querying users:", queryError);
    return NextResponse.json({ error: "Failed to query users" }, { status: 500 });
  }

  // Cross-reference with auth.users to find those who were unconfirmed
  // (confirmed today, never signed in)
  const { data: authUsers, error: authError } = await supabase.rpc("get_recently_confirmed_users");

  // If the RPC doesn't exist, fall back to a direct approach
  // We'll use the list from the request body instead
  let targetEmails: string[] = [];

  const body = await request.json().catch(() => ({}));

  if (body.emails && Array.isArray(body.emails)) {
    // Use explicitly provided email list
    targetEmails = body.emails;
  } else {
    return NextResponse.json(
      {
        error:
          "Please provide an 'emails' array in the request body with the list of emails to notify",
      },
      { status: 400 }
    );
  }

  const emailContent = createEmailTemplate({
    title: "Your Account is Now Verified",
    preheaderText: "Your Pathology Bites account has been verified — you can now log in!",
    content: `
      <p style="margin: 0 0 20px; font-size: 16px; line-height: 26px; color: #6b7280;">
        We recently identified a technical issue that prevented some users from completing their email verification. We sincerely apologize for the inconvenience.
      </p>
      <p style="margin: 0 0 25px; font-size: 16px; line-height: 26px; color: #6b7280;">
        The good news is that your account has been verified and is ready to use. You can now log in and start exploring Pathology Bites!
      </p>
    `,
    buttonText: "Log In to Pathology Bites",
    buttonUrl: "https://www.pathologybites.com/login",
    footerText: "Thank you for your patience — we're glad to have you on board!",
  });

  const results: { email: string; success: boolean; error?: string }[] = [];

  // Send emails with small delay to respect rate limits
  for (const email of targetEmails) {
    try {
      const emailResult = await resend.emails.send({
        from: "Pathology Bites <contact@pathologybites.com>",
        to: [email],
        subject: "Your Pathology Bites Account is Now Verified",
        html: emailContent.html,
        text: emailContent.text,
      });

      if (emailResult.error) {
        console.error(`Failed to send to ${email}:`, emailResult.error);
        results.push({ email, success: false, error: emailResult.error.message });
      } else {
        console.log(`Notification sent to ${email}`);
        results.push({ email, success: true });
      }
    } catch (err) {
      console.error(`Error sending to ${email}:`, err);
      results.push({
        email,
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }

    // Small delay between sends (100ms)
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  return NextResponse.json({
    message: `Sent ${succeeded} emails, ${failed} failed`,
    total: targetEmails.length,
    succeeded,
    failed,
    details: results,
  });
}
