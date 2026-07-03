// src/app/api/auth/check-email/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/shared/services/service-role-client";
import { parseBody } from "@/shared/utils/api/parse-body";
import { log } from "@/shared/utils/logging";

// Format validation stays in the handler so the "Invalid email format"
// message is preserved for clients.
const checkEmailSchema = z.object({
  email: z.string(),
});

/**
 * @swagger
 * /api/auth/check-email:
 *   post:
 *     summary: Check if email exists in the system
 *     description: Validates email format and checks if an account with the given email address already exists. This endpoint is used during registration to prevent duplicate accounts.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email address to check
 *                 example: user@example.com
 *     responses:
 *       200:
 *         description: Successfully checked email existence
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 exists:
 *                   type: boolean
 *                   description: Whether an account with this email exists
 *                   example: false
 *       400:
 *         description: Bad request - missing or invalid email
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Email is required
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Internal server error
 */
export async function POST(request: NextRequest) {
  try {
    const body = await parseBody(request, checkEmailSchema);
    if (body instanceof NextResponse) return body;
    const { email } = body;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    // Use service role client to bypass RLS policies
    const supabase = createServiceRoleClient();

    /**
     * EMAIL EXISTENCE CHECK - SINGLE SOURCE OF TRUTH
     *
     * We check public.users table which is kept in sync with auth.users via:
     * 1. Application code in auth routes creates public.users when auth.users is created
     * 2. Safeguards ensure public.users entries are created on signup/login
     * 3. Email uniqueness is enforced at the auth level by Supabase
     *
     * This ensures consistency with supabase.auth.signUp() which checks auth.users
     * If email exists in auth.users, it will also exist in public.users (via safeguards)
     */
    const { data, error } = await supabase.from("users").select("id").eq("email", email).single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 means no rows found, which is what we want for new emails
      log.error("Database error checking email in public.users:", error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    // If data exists, email is already registered
    const exists = !!data;

    return NextResponse.json({ exists });
  } catch (error) {
    log.error("Error in check-email API:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
