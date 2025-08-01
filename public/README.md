# Public Directory

This directory contains static assets that are served directly by the web server, including images, icons, data files, and other resources accessible via HTTP requests.

## Directory Structure

```
public/
├── content_specifications_merged.json  # Content specifications data
├── icons/                              # Application icons and symbols
│   ├── microscope.png                  # Microscope icon (PNG format)
│   └── microscope.svg                  # Microscope icon (SVG format)
├── images/                             # Static images and graphics
│   ├── cells/                          # Cell-related imagery
│   └── dr-albright.png                 # Profile image
└── README.md                           # This file
```

## File Types and Usage

### Data Files

**Note:** Data files have been moved to `src/data/` for better organization. They are now served via API endpoints rather than static files.

### Icons

#### `icons/microscope.png` & `icons/microscope.svg`
Application logo and branding icons.
- **Purpose**: Main application icon used in UI and branding
- **Formats**: Both PNG (raster) and SVG (vector) versions available
- **Usage**: Navigation bars, favicons, loading screens, branding
- **Optimization**: SVG preferred for scalability, PNG for compatibility

### Images

#### `images/dr-albright.png`
Profile or placeholder image.
- **Purpose**: User profile image or placeholder
- **Format**: PNG
- **Usage**: User interfaces, about pages, or placeholder content

#### `images/cells/`
Directory for cell-related imagery.
- **Purpose**: Educational content, backgrounds, or illustrations
- **Usage**: Question content, educational materials, UI backgrounds

## Access Patterns

### Direct HTTP Access
All files in the public directory are accessible via direct HTTP requests:
```
https://your-domain.com/content_specifications_merged.json
https://your-domain.com/icons/microscope.svg
https://your-domain.com/images/dr-albright.png
```

### Next.js Integration
Files are automatically served by Next.js without additional configuration:
```typescript
// In React components
<img src="/icons/microscope.svg" alt="Microscope" />
<img src="/images/dr-albright.png" alt="Dr. Albright" />

// In API routes or server-side code
const response = await fetch('/content_specifications_merged.json');
const data = await response.json();
```

## Performance Considerations

### Optimization
- **Image Compression**: Optimize images for web delivery
- **SVG Minification**: Minimize SVG files for faster loading
- **Caching**: Configure appropriate cache headers for static assets
- **CDN**: Consider CDN distribution for better global performance

### File Sizes
- **JSON Data**: Large data files should be compressed (gzip/brotli)
- **Images**: Use appropriate formats and compression levels
- **Icons**: Prefer SVG for scalable graphics, PNG for complex images

## Security Considerations

### Public Access
- **No Sensitive Data**: Never place sensitive information in public directory
- **File Permissions**: Ensure appropriate file permissions for web server access
- **Content Validation**: Validate any user-uploaded content before placing in public

### Content Security
- **CORS Headers**: Configure appropriate CORS policies for data files
- **Content-Type**: Ensure proper MIME types for all file types
- **Access Logs**: Monitor access patterns for security anomalies

## Deployment

### Build Process
1. **Data Sync**: Copy latest content specifications from `data/` directory
2. **Image Optimization**: Optimize images during build process
3. **Asset Verification**: Verify all referenced assets exist
4. **Cache Busting**: Implement cache busting for updated content

### Vercel Deployment
- **Automatic Serving**: Vercel automatically serves public directory contents
- **Edge Caching**: Static assets cached at edge locations globally
- **Compression**: Automatic gzip/brotli compression for text files
- **Headers**: Configure custom headers via `vercel.json` if needed

## Maintenance

### Regular Tasks
- **Content Updates**: Sync content specifications when data changes
- **Image Optimization**: Regularly optimize images for better performance
- **Cleanup**: Remove unused assets to reduce deployment size
- **Monitoring**: Monitor file access patterns and performance

### Content Management
- **Version Control**: Track changes to static assets in git
- **Backup**: Ensure static assets are included in backup strategies
- **Documentation**: Document the purpose and usage of each asset

## Development Guidelines

### Adding New Assets
1. **Appropriate Directory**: Place files in logical subdirectories
2. **Naming Convention**: Use descriptive, lowercase, hyphen-separated names
3. **Optimization**: Optimize files before adding to repository
4. **Documentation**: Update this README when adding new asset types

### File Naming
- **Lowercase**: Use lowercase filenames for consistency
- **Hyphens**: Use hyphens instead of spaces or underscores
- **Descriptive**: Use descriptive names that indicate purpose
- **Extensions**: Use appropriate file extensions (.png, .svg, .json, etc.)

### Size Limits
- **Individual Files**: Keep individual files under 10MB when possible
- **Total Size**: Monitor total public directory size for deployment efficiency
- **Compression**: Use compression for large text-based files

## Integration with Application

### Content Specifications
Content specifications are now served via API endpoints:
```typescript
// In admin components
const response = await fetch('/api/tools/abpath-content-specs');
const contentSpecs = await response.json();
```

### Icons and Images
Static assets are referenced throughout the application:
```typescript
// In React components
import Image from 'next/image';

<Image 
  src="/icons/microscope.svg" 
  alt="Pathology Bites Logo"
  width={32}
  height={32}
/>
```

### API Integration
Some public files may be accessed by API routes for data processing or serving to clients.

## Future Enhancements

### Planned Additions
- **Favicon**: Add favicon.ico and related icon files
- **Manifest**: Add web app manifest for PWA functionality
- **Robots.txt**: Add robots.txt for search engine optimization
- **Sitemap**: Add sitemap.xml for better SEO

### Content Expansion
- **Educational Images**: Additional pathology images and diagrams
- **Documentation**: PDF guides and reference materials
- **Multimedia**: Audio or video content for enhanced learning

---

For more information about static asset management in Next.js, see the [Next.js documentation](https://nextjs.org/docs/basic-features/static-file-serving).
