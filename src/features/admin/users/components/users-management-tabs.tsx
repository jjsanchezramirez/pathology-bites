// src/features/users/components/users-management-tabs.tsx
"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Button } from "@/shared/components/ui/button";
import { Download, Loader2, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "@/shared/utils/ui/toast";
import { UsersTable } from "./users-table";

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
      console.error("Error fetching waitlist:", error);
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
      console.error("Error fetching registered users:", error);
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
      console.error("Error exporting waitlist:", error);
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
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <UsersTable onUserChange={onUserChange} />
          )}
        </TabsContent>

        {/* Waitlist Tab */}
        <TabsContent value="waitlist" className="space-y-4">
          <div className="space-y-4">
            {/* Waitlist Header with Export */}
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-semibold">Waitlist Management</h3>
                <p className="text-muted-foreground text-sm">Users waiting for platform access</p>
              </div>
              <Button onClick={handleExportWaitlist} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>

            {/* Waitlist Table */}
            <div className="rounded-md border">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        Email
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        Status
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        Joined
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        Time Ago
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingWaitlist ? (
                      <tr>
                        <td colSpan={4} className="h-24 text-center">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                        </td>
                      </tr>
                    ) : filteredWaitlistData.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="h-24 text-center text-muted-foreground">
                          No waitlist entries found
                        </td>
                      </tr>
                    ) : (
                      filteredWaitlistData.map((entry) => (
                        <tr key={entry.id} className="border-b transition-colors hover:bg-muted/50">
                          <td className="p-4 align-middle">
                            <div className="font-medium">{entry.email}</div>
                          </td>
                          <td className="p-4 align-middle">
                            <div
                              className={`text-sm ${getStatusForEmail(entry.email) === "registered" ? "text-green-600" : "text-orange-600"}`}
                            >
                              {getStatusForEmail(entry.email) === "registered"
                                ? "Registered"
                                : "Waitlisted"}
                            </div>
                          </td>
                          <td className="p-4 align-middle">
                            <div className="text-sm text-muted-foreground">
                              {new Date(entry.created_at).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="p-4 align-middle">
                            <div className="text-sm text-muted-foreground">
                              {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
