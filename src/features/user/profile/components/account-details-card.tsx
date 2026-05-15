// src/features/profile/components/account-details-card.tsx

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { RoleBadge } from "@/shared/components/ui/role-badge";
import { UserStatusBadge } from "@/shared/components/ui/user-status-badge";
import { Separator } from "@/shared/components/ui/separator";
import { Shield } from "lucide-react";

interface UserProfile {
  id: string;
  email: string | null;
  role: string;
  first_name: string | null;
  last_name: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface AccountDetailsCardProps {
  userProfile: UserProfile;
}

export function AccountDetailsCard({ userProfile }: AccountDetailsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Account Details
        </CardTitle>
        <CardDescription>View your account status and role information.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Role</span>
            <RoleBadge role={userProfile.role} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Status</span>
            <UserStatusBadge status={userProfile.status} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">User ID</span>
            <span className="text-xs font-mono text-muted-foreground">{userProfile.id}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Last Updated</span>
            <span className="text-sm text-muted-foreground">
              {new Date(userProfile.updated_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
