// src/app/(admin)/admin/users/page.tsx
// Users hub: accounts, contact-form inquiries (?tab=inquiries) and announcements.
import { UsersAdmin } from "@/features/admin/users/components/users-admin";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  return <UsersAdmin initialTab={tab === "inquiries" ? "inquiries" : "users"} />;
}
