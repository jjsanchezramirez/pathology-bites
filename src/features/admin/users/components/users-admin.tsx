"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Megaphone } from "lucide-react";
import { UserStatsCards, UserStatsRef } from "./user-stats-cards";
import { PageHeader } from "@/shared/components/ui/page-header";
import { PageContainer, SectionCard } from "@/shared/components/ui/page-layout";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { SystemUpdateBroadcaster } from "@/features/admin/notifications/components/system-update-broadcaster";
import { InquiryStatistics } from "@/features/admin/inquiries/components/inquiry-statistics";
import { usePendingInquiriesCount } from "@/shared/hooks/use-pending-inquiries-count";

// Client-only: UsersTable reads the SWR cache, which is persisted to localStorage, so its
// first client render (cached rows) can never match a server render (loading state).
const UsersTable = dynamic(() => import("./users-table").then((m) => m.UsersTable), {
  ssr: false,
  loading: () => <Skeleton className="h-96 w-full" />,
});
const InquiriesTable = dynamic(
  () =>
    import("@/features/admin/inquiries/components/inquiries-table").then((m) => m.InquiriesTable),
  { ssr: false, loading: () => <Skeleton className="h-96 w-full" /> }
);

export type UsersAdminTab = "users" | "inquiries";

export function UsersAdmin({ initialTab }: { initialTab: UsersAdminTab }) {
  const router = useRouter();
  const userStatsRef = useRef<UserStatsRef>(null);
  const [tab, setTab] = useState<UsersAdminTab>(initialTab);
  const [inquiriesRefresh, setInquiriesRefresh] = useState(0);
  const [announceOpen, setAnnounceOpen] = useState(false);
  const { count: pendingInquiries } = usePendingInquiriesCount();

  const changeTab = (value: string) => {
    const next: UsersAdminTab = value === "inquiries" ? "inquiries" : "users";
    setTab(next);
    // Keep the tab in the URL so it survives reloads and can be linked to.
    router.replace(next === "users" ? "/admin/users" : "/admin/users?tab=inquiries", {
      scroll: false,
    });
  };

  return (
    <PageContainer>
      <PageHeader
        title="Users"
        description="Manage accounts, answer inquiries and send announcements."
        actions={
          <Button onClick={() => setAnnounceOpen(true)}>
            <Megaphone className="mr-2 h-4 w-4" />
            Send announcement
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={changeTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="inquiries" className="gap-2">
            Inquiries
            {pendingInquiries > 0 && (
              <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                {pendingInquiries}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-6">
          <UserStatsCards ref={userStatsRef} />
          <SectionCard
            title="Registered users"
            description="Click a user for details. Click a column header to sort."
          >
            <UsersTable onUserChange={() => userStatsRef.current?.refresh()} />
          </SectionCard>
        </TabsContent>

        <TabsContent value="inquiries" className="space-y-6">
          <InquiryStatistics refreshTrigger={inquiriesRefresh} />
          <SectionCard
            title="Inquiries"
            description="General inquiries and technical support requests from the contact form."
          >
            <InquiriesTable onInquiriesChange={setInquiriesRefresh} />
          </SectionCard>
        </TabsContent>
      </Tabs>

      <Dialog open={announceOpen} onOpenChange={setAnnounceOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Send announcement</DialogTitle>
            <DialogDescription>
              Shows up in the notifications of everyone in the audience you pick.
            </DialogDescription>
          </DialogHeader>
          <SystemUpdateBroadcaster onSent={() => setAnnounceOpen(false)} />
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
