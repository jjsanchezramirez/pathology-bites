// src/app/(admin)/admin/images/page.tsx
import { ImagesTable } from '@/components/images/image-table'
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card"

export default function ImagesPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Image Library</h1>
        <p className="text-muted-foreground">
          Manage and organize pathology images, diagrams, and illustrations
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Image Management</CardTitle>
          <CardDescription>
            Upload, edit, and organize your image collection. Images larger than 1MB will be automatically compressed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ImagesTable />
        </CardContent>
      </Card>
    </div>
  )
}