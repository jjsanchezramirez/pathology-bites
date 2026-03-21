// Public proxy for WSI question generation — allows unauthenticated USCAP guests
// to use the same AI generation logic without hitting middleware auth.
export { POST } from "@/app/api/user/wsi-questions/generate/route";
export { maxDuration } from "@/app/api/user/wsi-questions/generate/route";
