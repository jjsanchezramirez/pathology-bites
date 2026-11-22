// src/features/users/components/users-management-tabs.tsx
"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Button } from "@/shared/components/ui/button";
import { Download, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "@/shared/utils/ui/toast";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { PageSection, TableShell } from "@/shared/components/ui/page-layout";
import { UsersTable } from "./users-table";
import { log } from "@/shared/utils/logging";

interface WaitlistEntry {
  id: string;
  email: string;
  created_at: string;
}

interface WaitlistResponse {
  data: WaitlistEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface RegisteredUser {
  email: string;
  status: string;
}

interface RegisteredUsersResponse {
  users: RegisteredUser[];
}

interface UsersManagementTabsProps {
  onUserChange: () => void;
}

export function UsersManagementTabs({ onUserChange }: UsersManagementTabsProps) {
  const [activeTab, setActiveTab] = useState("users");
  const [waitlistData, setWaitlistData] = useState<WaitlistEntry[]>([]);
  const [loadingWaitlist, setLoadingWaitlist] = useState(true);
  const [searchTerm] = useState("");
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUser[]>([]);
  const [loadingRegisteredUsers, setLoadingRegisteredUsers] = useState(true);

  const fetchWaitlist = async () => {
    setLoadingWaitlist(true);
    try {
      // Fetch all waitlist entries by using a large limit
      const response = await fetch("/api/admin/waitlist?page=1&limit=1000");
      if (!response.ok) throw new Error("Failed to fetch waitlist");

      const result: WaitlistResponse = await response.json();
      setWaitlistData(result.data);
    } catch (error) {
      log.error("Error fetching waitlist:", error);
      toast.error("Failed to load waitlist data");
    } finally {
      setLoadingWaitlist(false);
    }
  };

  const fetchRegisteredUsers = async () => {
    setLoadingRegisteredUsers(true);
    try {
      // Fetch registered users emails and statuses
      const response = await fetch("/api/admin/users?page=1&pageSize=1000");
      if (!response.ok) throw new Error("Failed to fetch registered users");

      const result: RegisteredUsersResponse = await response.json();
      const users = result.users.map((user) => ({
        email: user.email,
        status: "registered",
      }));
      setRegisteredUsers(users);
    } catch (error) {
      log.error("Error fetching registered users:", error);
      toast.error("Failed to load registered users data");
    } finally {
      setLoadingRegisteredUsers(false);
    }
  };

  const handleExportWaitlist = async () => {
    try {
      const response = await fetch("/api/admin/waitlist?export=csv");
      if (!response.ok) throw new Error("Failed to export waitlist");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `waitlist-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      log.error("Error exporting waitlist:", error);
      toast.error("Failed to export waitlist");
    }
  };

  const filteredWaitlistData = waitlistData.filter((entry) =>
    entry.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Determine status for each waitlist entry
  const getStatusForEmail = (email: string): string => {
    const registeredUser = registeredUsers.find((user) => user.email === email);
    return registeredUser ? "registered" : "waitlisted";
  };

  // Fetch data when component mounts
  useEffect(() => {
    fetchRegisteredUsers();
  }, []);

  // Fetch waitlist data when waitlist tab is activated
  useEffect(() => {
    if (activeTab === "waitlist") {
      fetchWaitlist();
    }
  }, [activeTab]);

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Registered Users
          </TabsTrigger>
          <TabsTrigger value="waitlist" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Waitlist
          </TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          {loadingRegisteredUsers ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Skeleton className="h-10 flex-1" />
                <Skeleton className="h-10 w-32" />
              </div>
              <TableShell>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <Skeleton className="h-4 w-20" />
                      </TableHead>
                      <TableHead>
                        <Skeleton className="h-4 w-16" />
                      </TableHead>
                      <TableHead>
                        <Skeleton className="h-4 w-16" />
                      </TableHead>
                      <TableHead>
                        <Skeleton className="h-4 w-16" />
                      </TableHead>
                      <TableHead>
                        <Skeleton className="h-4 w-16" />
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <TableRow key={`skeleton-${i}`}>
                        <TableCell>
                          <Skeleton className="h-4 w-3/4" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-5 w-20 rounded-full" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-5 w-16 rounded-full" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-8 w-8 rounded" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableShell>
            </div>
          ) : (
            <UsersTable onUserChange={onUserChange} />
          )}
        </TabsContent>

        {/* Waitlist Tab */}
        <TabsContent value="waitlist" className="space-y-4">
          <PageSection
            title="Waitlist Management"
            description="Users waiting for platform access"
            actions={
              <Button onClick={handleExportWaitlist} variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            }
          >
            {/* Waitlist Table */}
            <TableShell>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Joined</TableHead>
                    <TableHead className="hidden md:table-cell">Time Ago</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingWaitlist ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <TableRow key={`skeleton-${i}`}>
                        <TableCell>
                          <Skeleton className="h-4 w-1/2" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : filteredWaitlistData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                        No waitlist entries found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredWaitlistData.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <div className="max-w-[16rem] truncate font-medium sm:max-w-none">
                            {entry.email}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div
                            className={`text-sm ${getStatusForEmail(entry.email) === "registered" ? "text-green-600" : "text-orange-600"}`}
                          >
                            {getStatusForEmail(entry.email) === "registered"
                              ? "Registered"
                              : "Waitlisted"}
                          </div>
                        </TableCell>
                        <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                          {new Date(entry.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                          {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableShell>
          </PageSection>
        </TabsContent>
      </Tabs>
    </div>
  );
}
