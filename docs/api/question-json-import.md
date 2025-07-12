# Question JSON Import Feature

## Overview

The Question JSON Import feature allows administrators to bulk import questions by providing structured JSON data. This is useful for migrating questions from other systems or creating questions programmatically.

## Accessing the Feature

1. Navigate to the Questions page (`/admin/questions`)
2. Click the "Add Question" dropdown button
3. Select "Import from JSON"

## JSON Format

### Required Fields

- `title` (string, 1-200 characters): The question title
- `stem` (string, 10-2000 characters): The main question text
- `difficulty` (enum): One of "easy", "medium", "hard"
- `teaching_point` (string, 10-1000 characters): Educational explanation
- `answer_options` (array, 2-10 items): Array of answer option objects

### Optional Fields

- `question_references` (string, max 500 characters): Reference citations
- `status` (enum): "draft" or "published" (defaults to "draft")
- `question_set_id` (UUID string): ID of existing question set
- `question_images` (array): Array of image association objects
- `tag_ids` (array of UUIDs): IDs of existing tags
- `category_ids` (array of UUIDs): IDs of existing categories

### Answer Option Object Structure

Each answer option must include:

```json
{
  "text": "Answer option text",
  "is_correct": true/false,
  "explanation": "Optional explanation text",
  "order_index": 0
}
```

**Required fields:**
- `text`: The answer option text (string, required)
- `is_correct`: Whether this option is correct (boolean, required)
- `order_index`: Display order starting from 0 (number, required)

**Optional fields:**
- `explanation`: Why this option is correct/incorrect (string, optional)

### Question Image Object Structure

```json
{
  "image_id": "uuid-of-existing-image",
  "question_section": "stem" or "explanation",
  "order_index": 0
}
```

**Required fields:**
- `image_id`: UUID of existing image in the database (string, required)
- `question_section`: Where to display the image - "stem" or "explanation" (string, required)
- `order_index`: Display order starting from 0 (number, required)

### Tags and Categories Format

**Tags (`tag_ids`):**
```json
"tag_ids": [
  "11111111-1111-1111-1111-111111111111",
  "22222222-2222-2222-2222-222222222222"
]
```

**Categories (`category_ids`):**
```json
"category_ids": [
  "33333333-3333-3333-3333-333333333333"
]
```

Both are arrays of UUID strings that must reference existing records in the database.

## Complete Example

See `src/data/api-examples/sample-question-import.json` for a complete working example.

## Validation

The system validates:

1. **JSON Syntax**: Must be valid JSON format
2. **Schema Validation**: All required fields present and correctly typed
3. **UUID Validation**: All referenced IDs must be valid UUIDs
4. **Database Constraints**: Referenced entities (question sets, tags, categories, images) must exist

## Error Handling

- **JSON Syntax Errors**: Clear error message indicating the syntax issue
- **Validation Errors**: Detailed field-by-field validation messages
- **Database Errors**: Warnings if related data fails to create (question still created)

## Import Process

1. **Question Creation**: Main question record is created first
2. **Related Data**: Answer options, images, tags, and categories are created in parallel
3. **Error Recovery**: If related data fails, the question is still created with a warning
4. **Success Notification**: Confirmation when import completes successfully

## Best Practices

1. **Test with Sample**: Use the provided sample JSON to test the format
2. **Validate UUIDs**: Ensure all referenced IDs exist in the database
3. **Check Permissions**: Only authenticated admin users can import questions
4. **Review Before Publishing**: Import as "draft" status first, then review and publish

## Troubleshooting

### Common Issues

1. **Invalid UUID Format**: Ensure all IDs are properly formatted UUIDs
2. **Missing References**: Referenced question sets, tags, or categories must exist
3. **Authentication**: Must be logged in as an admin user
4. **Field Length**: Respect character limits for text fields

### Getting UUIDs

To find the UUIDs needed for optional fields:

- **Question Sets**: Navigate to `/admin/question-management` → Question Sets tab
- **Tags**: Navigate to `/admin/question-management` → Tags tab
- **Categories**: Navigate to `/admin/question-management` → Categories tab
- **Images**: Navigate to `/admin/images` and check the image details

**Tip**: You can inspect the browser's developer tools (Network tab) when viewing these pages to see the actual UUID values returned by the API.

## API Endpoints Used

The import process uses these API endpoints:
- `POST /api/answer-options` - Creates answer options
- `POST /api/question-images` - Associates images with questions
- `POST /api/question-tags` - Associates tags with questions
- `POST /api/question-categories` - Associates categories with questions

## Security

- Authentication required (admin role)
- Input validation and sanitization
- SQL injection protection through parameterized queries
- XSS protection through proper encoding
