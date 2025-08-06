# API Directory

This directory contains optimized API endpoints with smart caching, R2 integration, and external service proxies.

## 🚀 Architecture Overview

### Smart Proxy Layer
All APIs implement intelligent caching and optimization strategies:
- **Client-side caching** with configurable TTL
- **R2 private bucket** access for data sources
- **External API proxies** with fallback handling
- **Zero-egress optimization** leveraging Cloudflare R2

## 📁 API Modules

### **/r2**: Cloudflare R2 Storage Integration
- **Private bucket access** with S3Client authentication
- **File management** and signed URL generation
- **Storage optimization** for zero-egress costs
- **Batch operations** for efficient data handling

### **/tools**: Educational Tool APIs
- **Citations Manager**: CrossRef, OpenLibrary, Google Books proxies
- **Gene Lookup**: HGNC and Harmonizome API integration
- **Virtual Slides**: R2-optimized slide data delivery
- **ABPath Content**: ASCP content specifications with R2 access
- **Cell Quiz**: Optimized cell morphology data and references

### **/auth**: Authentication & User Management
- Supabase authentication integration
- Session management and token handling
- Rate limiting for security

### **/admin**: Administrative Operations
- User management and content moderation
- Analytics and monitoring endpoints
- Bulk operations and maintenance

### **/debug**: Development & Monitoring
- System health checks and diagnostics
- Performance monitoring and metrics
- Development tools and utilities

### **/public**: Public Data Endpoints
- Publicly accessible statistics and information
- No authentication required
- Cached responses for performance

### **/content**: Content Management
- Question bank and educational content
- Media management and optimization
- Version control and audit trails

### **/quiz**: Quiz System
- Interactive quiz session management
- Progress tracking and analytics
- Performance optimization

### **/user**: User Data & Profiles
- Personal settings and preferences
- Learning progress and statistics
- Dashboard data aggregation

## 🔧 Optimization Features

### Smart Caching Strategy
```typescript
// Example: Citations API with caching
export async function GET(request: Request) {
  // Check client-side cache first
  // Proxy to external APIs with fallback
  // Cache successful responses
  // Return optimized data
}
```

### R2 Integration Pattern
```typescript
// Example: Data fetching from R2
const command = new GetObjectCommand({
  Bucket: 'pathology-bites-data',
  Key: 'virtual-slides.json'
})
const response = await s3Client.send(command)
```

### External API Proxy
```typescript
// Example: Gene lookup with fallback
try {
  const hgncResponse = await fetch('https://rest.genenames.org/...')
  if (!hgncResponse.ok) {
    // Fallback to alternative API
  }
} catch (error) {
  // Graceful degradation
}
```

## 🔒 Security & Performance

### Rate Limiting
- Critical endpoints protected with rate limiting
- IP-based and user-based throttling
- Graceful degradation under load

### Error Handling
- Comprehensive error catching and logging
- Fallback strategies for external API failures
- User-friendly error messages

### Performance Optimization
- Response compression (Brotli/gzip via Next.js)
- Cache headers for optimal caching
- Minimal response payloads