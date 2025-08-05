# Cloudflare R2 Storage API

This directory contains API endpoints for interacting with Cloudflare R2 storage, providing file management capabilities for the Pathology Bites application.

## Endpoints

### GET `/api/r2/files`

Lists files in the Cloudflare R2 bucket with pagination, filtering, and search capabilities.

#### Authentication
- **Required**: Admin or Creator role
- **Rate Limited**: 200 requests per minute (admin rate limiter)

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number for pagination |
| `limit` | number | 50 | Number of files per page (max 1000) |
| `prefix` | string | - | Filter files by key prefix (folder path) |
| `search` | string | - | Search files by key name (case-insensitive) |
| `sortBy` | string | 'name' | Sort field: 'name', 'size', 'lastModified' |
| `sortOrder` | string | 'asc' | Sort order: 'asc' or 'desc' |

#### Response Format

```json
{
  "files": [
    {
      "key": "images/microscopic/1234567890-sample.jpg",
      "url": "https://pub-account.r2.dev/images/microscopic/1234567890-sample.jpg",
      "size": 245760,
      "lastModified": "2024-01-15T10:30:00.000Z",
      "contentType": "image/jpeg",
      "etag": "\"d41d8cd98f00b204e9800998ecf8427e\""
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "totalItems": 150,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPreviousPage": false
  },
  "metadata": {
    "prefix": "images/",
    "search": null,
    "sortBy": "name",
    "sortOrder": "asc",
    "bucketName": "pathology-bites-images",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

#### Error Responses

```json
// 401 Unauthorized
{
  "error": "Unauthorized"
}

// 403 Forbidden
{
  "error": "Forbidden - Admin or Creator access required"
}

// 500 Internal Server Error
{
  "error": "Failed to list R2 files",
  "details": "Specific error message"
}
```

#### Example Usage

```typescript
// Basic file listing
const response = await fetch('/api/r2/files?page=1&limit=20')
const data = await response.json()

// Filter by folder
const imagesResponse = await fetch('/api/r2/files?prefix=images/&limit=50')

// Search for specific files
const searchResponse = await fetch('/api/r2/files?search=microscopic&sortBy=size&sortOrder=desc')

// Paginate through large datasets
const page2Response = await fetch('/api/r2/files?page=2&limit=100')
```

### Other R2 Endpoints

- `POST /api/r2/signed-url` - Generate single signed URL
- `POST /api/r2/signed-urls/batch` - Generate batch signed URLs

## Environment Variables

The R2 API requires the following environment variables:

```env
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_R2_ACCESS_KEY_ID=your_access_key_id
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your_secret_access_key
CLOUDFLARE_R2_BUCKET_NAME=pathology-bites-images
CLOUDFLARE_R2_PUBLIC_URL=https://pub-account.r2.dev
```

## Security Features

1. **Authentication Required**: All endpoints require valid user authentication
2. **Role-Based Access**: Admin and Creator roles only
3. **Rate Limiting**: Prevents abuse with configurable limits
4. **Input Validation**: All parameters are validated and sanitized
5. **Error Handling**: Secure error messages without sensitive information

## Performance Optimizations

1. **Pagination**: Efficient handling of large file lists
2. **Caching**: Response caching with appropriate headers
3. **Batch Operations**: Optimized for bulk file operations
4. **Direct R2 Access**: Minimizes Vercel function usage

## File Operations Supported

- **List Files**: Browse bucket contents with filtering
- **File Metadata**: Size, modification date, content type
- **Public URLs**: Direct access URLs for files
- **Search**: Find files by name patterns
- **Sorting**: Multiple sort options for organization

## Integration with Existing Systems

This API integrates seamlessly with:
- Existing R2 storage service (`/src/shared/services/r2-storage.ts`)
- Admin authentication system
- Rate limiting infrastructure
- Error handling patterns
- TypeScript type definitions

## Future Enhancements

Potential improvements for future versions:
- File upload endpoint
- Bulk file operations
- File metadata editing
- Folder management
- Advanced filtering options
- File preview generation
