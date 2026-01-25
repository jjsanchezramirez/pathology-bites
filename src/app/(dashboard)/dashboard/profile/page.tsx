// src/app/(dashboard)/dashboard/profile/page.tsx
"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/shared/services/client";
import { Card, CardContent } from "@/shared/components/ui/card";
import { useAuthContext } from "@/features/auth/components/auth-provider";
import { PasswordChangeForm } from "@/features/auth/components/forms/password-change-form";
import {
  ProfileLoading,
  ProfileInformationCard,
  AccountDetailsCard,
} from "@/features/profile/components";
import { toast } from "@/shared/utils/toast";

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

function ProfilePageContent() {
  const { user, isAuthenticated, isLoading } = useAuthContext();
  const searchParams = useSearchParams();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    institution: "",
    user_type: "",
  });
  const [originalFormData, setOriginalFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    institution: "",
    user_type: "",
  });

  const supabase = createClient();

  // Handle URL parameters for messages
  useEffect(() => {
    if (!searchParams) return;

    const error = searchParams.get("error");
    const message = searchParams.get("message");
    const success = searchParams.get("success");

    if (error) {
      toast.error(decodeURIComponent(error));
    } else if (success) {
      toast.success(decodeURIComponent(success));
    } else if (message) {
      toast.info(decodeURIComponent(message));
    }
  }, [searchParams]);

  const fetchUserProfile = useCallback(async () => {
    try {
      setProfileLoading(true);
      const { data, error } = await supabase.from("users").select("*").eq("id", user?.id).single();

      if (error) throw error;

      setUserProfile(data);
      const profileData = {
        first_name: data.first_name || "",
        last_name: data.last_name || "",
        email: data.email || "",
        institution: data.institution || "",
        user_type: data.user_type || "",
      };
      setFormData(profileData);
      setOriginalFormData(profileData);
    } catch (error) {
      console.error("Error fetching profile:", error);
      toast.error("Failed to load profile");
    } finally {
      setProfileLoading(false);
    }
  }, [user?.id, supabase]);

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchUserProfile();
    }
  }, [isAuthenticated, user, fetchUserProfile]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const { error } = await supabase
        .from("users")
        .update({
          first_name: formData.first_name || null,
          last_name: formData.last_name || null,
          institution: formData.institution || null,
          user_type: formData.user_type || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user?.id);

      if (error) throw error;

      toast.success("Profile updated successfully");
      await fetchUserProfile();
      setIsEditMode(false);
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = () => {
    setIsEditMode(true);
  };

  const handleCancel = () => {
    setFormData(originalFormData);
    setIsEditMode(false);
  };

  if (isLoading || profileLoading) {
    return <ProfileLoading />;
  }

  if (!isAuthenticated || !user || !userProfile) {
    return (
      <div className="py-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Please log in to view your profile.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">My Profile</h1>
          <p className="text-muted-foreground">Manage your account information and preferences.</p>
        </div>

        <div className="space-y-6">
          {/* Profile Information */}
          <ProfileInformationCard
            formData={formData}
            isEditMode={isEditMode}
            saving={saving}
            onFormDataChange={(data) => setFormData((prev) => ({ ...prev, ...data }))}
            onEdit={handleEdit}
            onCancel={handleCancel}
            onSave={handleSave}
          />

          {/* Account Details */}
          <AccountDetailsCard userProfile={userProfile} />

          {/* Password Change */}
          <PasswordChangeForm />
        </div>
      </div>
    </div>
  );
}

export default function MyProfilePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ProfilePageContent />
    </Suspense>
  );
}
