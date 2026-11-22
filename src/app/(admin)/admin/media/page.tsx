import { MediaAdmin } from "@/features/admin/media/components/media-admin";
import { DEFAULT_MEDIA_TAB } from "@/features/admin/media/constants";

export default async function MediaPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  return <MediaAdmin initialTab={tab ?? DEFAULT_MEDIA_TAB} />;
}
