/**
 * Ask Dr. Albright is OFF unless NEXT_PUBLIC_ASK_ALBRIGHT_ENABLED is "true".
 * One flag gates both the dashboard button (client) and the API route
 * (server). NEXT_PUBLIC_ values are inlined at build time, so turning it on
 * or off takes a redeploy.
 */
export const ASK_ALBRIGHT_ENABLED = process.env.NEXT_PUBLIC_ASK_ALBRIGHT_ENABLED === "true";
