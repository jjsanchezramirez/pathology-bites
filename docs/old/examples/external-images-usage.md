# External Images Usage Guide

This guide shows how to use the new external images functionality for PathOutlines integration.

## Overview

External images are a special category of images that only store a URL reference without uploading the actual file. They are perfect for referencing images from external sources like PathOutlines.

## Key Features

- **Minimal storage**: Only stores `id`, `url`, and `category`
- **Excluded from management**: Don't appear in the images management table
- **Full integration**: Can be used in questions just like regular images
- **Automatic deduplication**: Built-in function to avoid duplicate URLs

## Database Schema

External images have the following characteristics:
- `category` = 'external'
- `storage_path` = null
- `file_type` = null
- `alt_text` = null
- `description` = null
- `source_ref` = null

## Usage Examples

### 1. Create External Image

```javascript
import { createExternalImage } from '@/features/images/services';

// Create a new external image
const externalImage = await createExternalImage(
  'https://pathoutlines.com/images/example.jpg',
  userId // optional
);

console.log(externalImage.id); // Use this ID in question_images
```

### 2. Create External Image (Avoid Duplicates)

```javascript
import { createExternalImageIfNotExists } from '@/features/images/services';

// Create external image only if it doesn't already exist
const externalImage = await createExternalImageIfNotExists(
  'https://pathoutlines.com/images/example.jpg',
  userId // optional
);
```

### 3. Use in Question Import

```javascript
// Example PathOutlines question import
async function importPathOutlinesQuestion(questionData) {
  const imageIds = [];
  
  // Process images in question content
  for (const imageUrl of questionData.imageUrls) {
    const externalImage = await createExternalImageIfNotExists(imageUrl);
    imageIds.push(externalImage.id);
  }
  
  // Create question with external image references
  const question = await createQuestion({
    title: questionData.title,
    stem: questionData.stem,
    // ... other fields
  });
  
  // Link external images to question
  for (let i = 0; i < imageIds.length; i++) {
    await createQuestionImage({
      question_id: question.id,
      image_id: imageIds[i],
      question_section: 'stem',
      order_index: i
    });
  }
}
```

## Database Queries

### Get All External Images
```sql
SELECT id, url FROM images WHERE category = 'external';
```

### Get Regular Images (Excludes External)
```sql
SELECT * FROM images WHERE category != 'external';
```

### Get Question with External Images
```sql
SELECT 
  q.title,
  qi.question_section,
  i.url as image_url,
  i.category
FROM questions q
JOIN question_images qi ON q.id = qi.question_id
JOIN images i ON qi.image_id = i.id
WHERE q.id = 'question-uuid'
ORDER BY qi.order_index;
```

## Benefits for PathOutlines Integration

1. **No Storage Costs**: External images don't use Supabase storage
2. **Fast Import**: No need to download and re-upload images
3. **Automatic Deduplication**: Same URL won't be stored twice
4. **Clean Separation**: External images don't clutter the management interface
5. **Full Compatibility**: Work seamlessly with existing question system

## Migration Notes

The migration `06-add-external-images-support.sql` handles:
- Making required fields nullable for external images
- Adding check constraints to ensure data integrity
- Updating category constraints to include 'external'
- Creating indexes for performance
