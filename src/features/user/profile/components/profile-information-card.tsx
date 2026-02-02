// src/features/profile/components/profile-information-card.tsx

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { User, Save, RefreshCw, Edit, X } from "lucide-react";

interface ProfileFormData {
  first_name: string;
  last_name: string;
  email: string;
  institution: string;
  user_type: string;
}

interface ProfileInformationCardProps {
  formData: ProfileFormData;
  isEditMode: boolean;
  saving: boolean;
  onFormDataChange: (data: Partial<ProfileFormData>) => void;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
}

export function ProfileInformationCard({
  formData,
  isEditMode,
  saving,
  onFormDataChange,
  onEdit,
  onCancel,
  onSave,
}: ProfileInformationCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Profile Information
        </CardTitle>
        <CardDescription>Update your personal information.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="flex-1 grid gap-2">
            <Label htmlFor="first_name">First Name</Label>
            <Input
              id="first_name"
              value={formData.first_name}
              onChange={(e) => onFormDataChange({ first_name: e.target.value })}
              placeholder="Enter your first name"
              disabled={!isEditMode}
              className={!isEditMode ? "bg-muted" : ""}
            />
          </div>
          <div className="flex-1 grid gap-2">
            <Label htmlFor="last_name">Last Name</Label>
            <Input
              id="last_name"
              value={formData.last_name}
              onChange={(e) => onFormDataChange({ last_name: e.target.value })}
              placeholder="Enter your last name"
              disabled={!isEditMode}
              className={!isEditMode ? "bg-muted" : ""}
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="institution">Institution</Label>
          <Input
            id="institution"
            value={formData.institution}
            onChange={(e) => onFormDataChange({ institution: e.target.value })}
            placeholder="Enter your institution"
            disabled={!isEditMode}
            className={!isEditMode ? "bg-muted" : ""}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="user_type">User Type</Label>
          <Select
            value={formData.user_type}
            onValueChange={(value) => onFormDataChange({ user_type: value })}
            disabled={!isEditMode}
          >
            <SelectTrigger className={!isEditMode ? "bg-muted" : ""}>
              <SelectValue placeholder="Select your user type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="student">Student</SelectItem>
              <SelectItem value="resident">Resident</SelectItem>
              <SelectItem value="fellow">Fellow</SelectItem>
              <SelectItem value="attending">Attending/Faculty</SelectItem>
              <SelectItem value="researcher">Researcher</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={formData.email} disabled className="bg-muted" />
        </div>
        {!isEditMode ? (
          <Button onClick={onEdit} className="w-full">
            <Edit className="mr-2 h-4 w-4" />
            Edit Profile
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button onClick={onCancel} variant="outline" className="flex-1" disabled={saving}>
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button onClick={onSave} disabled={saving} className="flex-1">
              {saving ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
