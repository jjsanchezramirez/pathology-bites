# 🖼️ Images Feature

## Overview

The Images feature provides comprehensive image management for the Pathology Bites application, including upload, organization, search, analytics, and cleanup functionality.

## 📁 Structure

```
src/features/images/
├── components/           # React components
│   ├── image-table.tsx          # Main table with search/filter
│   ├── storage-stats.tsx        # Storage statistics cards
│   ├── upload-dialog.tsx        # Image upload dialog
│   ├── edit-dialog.tsx          # Image editing dialog
│   ├── delete-image-dialog.tsx  # Single deletion confirmation
│   ├── cleanup-dialog.tsx       # Batch cleanup confirmation
│   ├── image-preview.tsx        # Full-screen image viewer
│   ├── image-carousel.tsx       # Multi-image gallery
│   └── index.ts                 # Component exports
├── services/             # Business logic
│   ├── images.ts                # Core CRUD operations
│   ├── image-analytics.ts       # Storage stats & analytics
│   ├── image-upload.ts          # Upload utilities
│   └── image-edit.ts            # Edit operations
├── types/               # TypeScript definitions
│   └── images.ts               # Image-related types
└── README.md           # This file
```

## 🎯 Key Features

### Storage Management
- **Real-time statistics**: Total images, storage used, unused images (uploaded only)
- **Storage limits**: 1GB Supabase free tier monitoring (excludes external images)
- **Auto-compression**: Images >1MB automatically compressed
- **Cleanup tools**: Batch deletion of unused images
- **External exclusion**: All analytics exclude external images from calculations

### Image Operations
- **Upload**: Single/multiple files with drag & drop
- **Search**: Full-text search with prefix matching
- **Filter**: By category and usage status
- **Edit**: Metadata updates (name, description, category)
- **Delete**: Individual and batch deletion

### Advanced Features
- **Usage tracking**: Real-time orphaned image detection
- **Category management**: Microscopic, Gross, Figure, Table
- **Search optimization**: PostgreSQL full-text search with GIN indexes
- **Responsive design**: Mobile-first approach

## 🔧 Components

### StorageStatsCards
Real-time storage statistics dashboard with auto-refresh.

```tsx
import { StorageStatsCards, StorageStatsRef } from '@/features/images/components';

const ref = useRef<StorageStatsRef>(null);

// Refresh stats programmatically
ref.current?.refresh();

<StorageStatsCards ref={ref} />
```

### ImagesTable
Main table component with search, filtering, and pagination.

```tsx
import { ImagesTable } from '@/features/images/components';

<ImagesTable onImageChange={() => {
  // Called when images are added/deleted/edited
  statsRef.current?.refresh();
}} />
```

### Upload/Edit Dialogs
Modal dialogs for image operations with proper validation.

```tsx
import { UploadDialog, EditDialog } from '@/features/images/components';

<UploadDialog
  open={showUpload}
  onOpenChange={setShowUpload}
  onUpload={handleUploadComplete}
/>
```

## 🗄️ Services

### Core Operations
```typescript
import { 
  fetchImages, 
  uploadImage, 
  updateImage, 
  deleteImage 
} from '@/features/images/services/images';

// Fetch with pagination and filters
const result = await fetchImages({
  page: 1,
  pageSize: 20,
  searchTerm: 'microscopic',
  category: 'microscopic',
  showUnusedOnly: false
});

// Upload with compression
await uploadImage({
  file: imageFile,
  category: 'microscopic',
  description: 'Sample image',
  sourceRef: 'Reference'
});
```

### Analytics
```typescript
import { 
  getStorageStats, 
  getImageUsageStats,
  getOrphanedImages 
} from '@/features/images/services/image-analytics';

// Get storage overview
const stats = await getStorageStats();
console.log(`${stats.total_images} images, ${stats.formatted_total_size}`);

// Get detailed usage data
const usage = await getImageUsageStats();
usage.forEach(img => {
  console.log(`${img.alt_text}: used in ${img.usage_count} questions`);
});
```

## 🔗 External Image Handling

### Image Types
The system handles two distinct types of images:

#### Uploaded Images
- Stored in Supabase storage bucket
- Count toward 1GB storage limit
- Included in all analytics and statistics
- Can be managed (edit, delete, cleanup)
- Categories: microscopic, gross, figure, table

#### External Images
- URL references only (PathOutlines images)
- Do not use Supabase storage
- **Excluded from all analytics and statistics**
- Read-only (cannot be managed)
- Category: always 'external'

### Analytics Exclusion
All database views and analytics exclude external images:

```sql
-- Standard filter used across all views
WHERE category != 'external'
```

This ensures accurate storage calculations and prevents external images from affecting cleanup operations.

## 📊 Database Integration

### Views Used
- `v_image_usage_stats` - Complete image data with usage analytics (excludes external)
- `v_storage_stats` - Storage utilization summary (excludes external)
- `v_orphaned_images` - Unused images for cleanup (excludes external)
- `v_image_usage_by_category` - Category-based analytics (excludes external)
- `v_dashboard_stats` - Dashboard statistics (excludes external)

### Search Implementation
```sql
-- Full-text search with GIN index
SELECT * FROM images 
WHERE search_vector @@ to_tsquery('english', 'microscopic:*')
AND category != 'external';

-- Fallback ILIKE search
SELECT * FROM images 
WHERE (alt_text ILIKE '%term%' OR description ILIKE '%term%')
AND category != 'external';
```

## 🎨 Styling & UX

### Design Principles
- **Consistent dialogs**: Blurred backgrounds, standard confirmation patterns
- **Real-time feedback**: Immediate updates on all operations
- **Progressive disclosure**: Advanced features available but not overwhelming
- **Mobile-first**: Responsive design for all screen sizes

### Dialog Patterns
All confirmation dialogs follow the same pattern:
```
Title: "Confirm [Action]"
Message: "Are you sure you want to [action details]?"
Subtitle: "This action cannot be undone."
Buttons: [Cancel] [Confirm Action]
```

## 🧪 Testing

### Test Coverage
- Database schema and views
- Search functionality (prefix and ILIKE)
- Analytics calculations
- Performance benchmarks
- Error handling

### Running Tests
```bash
# Component tests
npm test src/features/images

# Integration tests  
npm run test:integration images

# E2E tests
npm run test:e2e images
```

## 🚀 Performance

### Optimizations
- **Database indexes**: GIN indexes for full-text search
- **Lazy loading**: Paginated results with virtual scrolling
- **Image compression**: Automatic size reduction
- **View caching**: Pre-calculated analytics

### Benchmarks
- Search queries: <300ms average
- Storage stats: <150ms average
- Upload processing: <2s for 1MB images
- Cleanup operations: <5s for 100 images

## 🔮 Future Enhancements

### Planned Features
- **Image versioning**: Track changes over time
- **Bulk operations**: Multi-select for batch editing
- **Advanced search**: Metadata-based queries
- **CDN integration**: Faster global delivery

### Scalability Considerations
- **Storage tiers**: Migration to paid Supabase plans
- **Background processing**: Async image optimization
- **Microservices**: Separate image processing service
- **Caching layers**: Redis for frequently accessed data

## 📚 Related Documentation

- [Database Schema](../../../docs/architecture/DATABASE_SCHEMA.md)
- [Image Management System](../../../docs/features/IMAGE_MANAGEMENT_SYSTEM.md)
- [Storage Capacity Analysis](../../../docs/technical/STORAGE_CAPACITY_ANALYSIS.md)
- [API Documentation](../../../docs/api/IMAGES_API.md)
