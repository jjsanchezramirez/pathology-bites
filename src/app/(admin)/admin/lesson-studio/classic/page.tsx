// The canvas editor moved to /admin/lesson-studio; keep old links working.
import { redirect } from "next/navigation";

export default function ClassicRedirect() {
  redirect("/admin/lesson-studio");
}
