# 🖼️ Image Management System

## Overview

The Image Management System provides comprehensive functionality for uploading, organizing, and managing pathology images used in questions. It includes storage analytics, unused image detection, batch operations, and real-time statistics.

## 🏗️ Architecture

### Core Components

#### **Frontend Components**
- `ImagesTable` - Main table with search, filtering, and pagination
- `StorageStatsCards` - Real-time storage statistics dashboard
- `UploadDialog` - Single/multiple image upload with compression
- `EditDialog` - Image metadata editing
- `DeleteImageDialog` - Single image deletion confirmation
- `CleanupDialog` - Batch unused image deletion
- `ImagePreview` - Full-screen image viewing
- `ImageCarousel` - Multi-image gallery navigation

#### **Services**
- `images.ts` - Core CRUD operations and fetching
- `image-analytics.ts` - Storage stats and usage analytics
- `image-upload.ts` - Upload utilities and compression
- `image-edit.ts` - Image metadata updates

#### **Database Views**
- `v_image_usage_stats` - Complete image metadata with usage analytics
- `v_storage_stats` - Storage utilization summary
- `v_orphaned_images` - Unused images for cleanup
- `v_image_usage_by_category` - Analytics by category
- `v_recent_image_activity` - Recent activity monitoring

## 📊 Features

### Storage Statistics Dashboard
- **Total Images**: Count and total file size
- **Storage Used**: Current usage vs 1GB Supabase limit
- **Unused Images**: Count and size of orphaned images
- **Cleanup**: Batch deletion of unused images

### Image Management
- **Upload**: Single/multiple files with automatic compression
- **Search**: Full-text search across names, descriptions, references
- **Filter**: By category (Microscopic, Gross, Figure, Table, Unused)
- **Edit**: Metadata updates (name, description, category, source)
- **Delete**: Individual image deletion with confirmation

### Advanced Features
- **Auto-compression**: Images >1MB automatically compressed
- **Usage tracking**: Real-time detection of unused images
- **Batch operations**: Multiple file upload and cleanup
- **Real-time updates**: Statistics refresh on all operations

## 🗂️ Image Categories

### Uploaded Categories
- **Microscopic**: Histological images from microscopes
- **Gross**: Macroscopic specimens and surgical pathology
- **Figure**: Diagrams, charts, illustrations
- **Table**: Statistical data and classification systems

### Special Categories
- **External**: PathOutlines images (URL only, not uploaded)
- **Unused**: Filter to show orphaned images

## 🔍 Search & Filtering

### Search Capabilities
- **Full-text search** with PostgreSQL GIN indexes
- **Prefix matching**: "castle" finds "Castleman disease"
- **Multi-word support**: "liver cell" finds both terms
- **Field coverage**: Names, descriptions, source references

### Filter Options
- **All Categories**: Show all uploaded images
- **Unused Images**: Show only orphaned images
- **Category-specific**: Filter by image type
- **Combined**: Search + category filtering

## 💾 Storage Management

### Storage Limits
- **Supabase Free Tier**: 1GB total storage
- **Auto-compression**: Reduces file sizes automatically
- **Usage monitoring**: Real-time tracking vs limits

### Cleanup Operations
- **Unused detection**: Automatic identification
- **Batch deletion**: Remove multiple unused images
- **Storage recovery**: Immediate space reclamation
- **Safety confirmations**: Multiple warnings before deletion

## 🔄 Real-time Updates

### Auto-refresh Triggers
- **Image upload**: Statistics update immediately
- **Image deletion**: Counts and sizes refresh
- **Image editing**: Usage status may change
- **Cleanup operations**: Bulk statistics updates

### Implementation
```typescript
// Storage stats refresh on image changes
const handleImageChange = () => {
  storageStatsRef.current?.refresh();
};

// Integrated into all image operations
onImageChange?.(); // Called after upload/delete/edit
```

## 🛡️ Data Integrity

### Usage Tracking
- **Real-time calculation**: Via database views
- **Orphaned detection**: Images not in any questions
- **Usage counts**: Number of questions using each image
- **Question references**: Array of question IDs

### Cleanup Safety
- **Confirmation dialogs**: Multiple warnings
- **Orphaned-only**: Only removes truly unused images
- **Reversible**: Can re-upload if needed
- **Audit trail**: Deletion logging

## 📱 User Experience

### Responsive Design
- **Mobile-first**: Works on all screen sizes
- **Touch-friendly**: Large tap targets
- **Adaptive layout**: Cards stack on mobile

### Visual Feedback
- **Loading states**: Progress indicators
- **Success/error**: Toast notifications
- **Real-time updates**: Immediate statistics
- **Confirmation dialogs**: Clear warnings

### Accessibility
- **Keyboard navigation**: Full keyboard support
- **Screen readers**: Proper ARIA labels
- **High contrast**: Readable in all modes
- **Focus management**: Logical tab order

## 🔧 Technical Implementation

### Database Schema
```sql
-- Core images table
CREATE TABLE images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  storage_path text,
  file_type text,
  description text,
  alt_text text,
  category text NOT NULL,
  source_ref text,
  file_size_bytes bigint,
  width integer,
  height integer,
  search_vector tsvector,
  created_by uuid REFERENCES users(id),
  created_at timestamp DEFAULT now()
);

-- Usage tracking via question_images
CREATE TABLE question_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid REFERENCES questions(id) ON DELETE CASCADE,
  image_id uuid REFERENCES images(id) ON DELETE CASCADE,
  created_at timestamp DEFAULT now()
);
```

### Performance Optimizations
- **GIN indexes**: Fast full-text search
- **Composite indexes**: Efficient filtering
- **Database views**: Pre-calculated analytics
- **Lazy loading**: Paginated results
- **Image compression**: Reduced storage usage

### Error Handling
- **Graceful degradation**: Fallback to simple search
- **User feedback**: Clear error messages
- **Retry logic**: Automatic retry on failures
- **Cleanup on errors**: Remove partial uploads

## 🧪 Testing

### Test Coverage
- **Unit tests**: Individual functions
- **Integration tests**: Component interactions
- **E2E tests**: Full user workflows
- **Performance tests**: Load and stress testing

### Test Scenarios
- **Upload workflows**: Single and batch uploads
- **Search functionality**: All search patterns
- **Filter combinations**: Category + search
- **Cleanup operations**: Unused image deletion
- **Error conditions**: Network failures, storage limits

## 🚀 Deployment

### Environment Setup
- **Supabase project**: Database and storage
- **Environment variables**: API keys and URLs
- **Storage bucket**: Public read access
- **Database migrations**: Schema updates

### Monitoring
- **Storage usage**: Track against limits
- **Upload success rates**: Monitor failures
- **Search performance**: Query timing
- **User activity**: Usage analytics

## 📈 Analytics

### Usage Metrics
- **Upload frequency**: Images per day/week
- **Category distribution**: Most used types
- **Storage growth**: Size over time
- **Cleanup frequency**: Unused image removal

### Performance Metrics
- **Search response time**: Query performance
- **Upload success rate**: Failure tracking
- **Storage efficiency**: Compression ratios
- **User engagement**: Feature usage

## 🔮 Future Enhancements

### Planned Features
- **Image versioning**: Track changes over time
- **Bulk editing**: Update multiple images
- **Advanced search**: Metadata-based queries
- **Image optimization**: WebP conversion
- **CDN integration**: Faster image delivery

### Scalability
- **Storage tiers**: Move to paid plans
- **CDN caching**: Global image delivery
- **Background processing**: Async operations
- **Microservices**: Separate image service
