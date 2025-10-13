// src/app/(admin)/admin/labels/page.tsx
import { Metadata } from 'next'
import { TagsManagementGrid } from '@/features/questions/components/tags-management-grid'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'

export const metadata: Metadata = {
  title: 'Tag Management - Admin Dashboard',
  description: 'Manage question tags with an interactive grid interface',
}

export default function LabelManagementPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Tag Management</h1>
        <p className="text-muted-foreground">
          Organize your question bank with tags. Create, edit, merge, and delete tags to keep your content well-organized.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tags</CardTitle>
          <CardDescription>
            Manage tags to categorize and organize questions by topic, theme, or any custom criteria
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TagsManagementGrid />
        </CardContent>
      </Card>
    </div>
  )
}
