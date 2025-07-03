# API Documentation

This document provides comprehensive documentation for the Pathology Bites API endpoints.

## 🔐 Authentication

All API endpoints use Supabase authentication with JWT tokens. Include the authorization header in requests:

```bash
Authorization: Bearer <jwt_token>
```

### Rate Limiting

API endpoints are rate limited to prevent abuse:

- **Authentication**: 10 requests per 15 minutes
- **General API**: 100 requests per minute  
- **Admin API**: 200 requests per minute
- **Quiz API**: 50 requests per minute

Rate limit headers are included in all responses:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Reset timestamp

## 🔑 Authentication Endpoints

### POST /api/auth/callback
Handles OAuth callback and email verification.

**Rate Limited**: Yes (auth limiter)

**Parameters**:
- `code` (query): OAuth authorization code
- `next` (query): Redirect URL after authentication

**Response**:
```json
{
  "success": true,
  "redirect": "/dashboard"
}
```

## 👨‍💼 Admin Endpoints

### GET /api/admin/users
Retrieve all users (admin only).

**Rate Limited**: Yes (admin limiter)

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (default: 20)
- `role` (optional): Filter by user role
- `status` (optional): Filter by user status

**Response**:
```json
{
  "users": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "role": "user",
      "status": "active",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 100,
  "page": 1,
  "limit": 20
}
```

### GET /api/admin/system-status
Get system health status (admin only).

**Rate Limited**: Yes (admin limiter)

**Response**:
```json
{
  "status": "healthy",
  "database": {
    "connected": true,
    "response_time": 45
  },
  "supabase": {
    "connected": true,
    "response_time": 23
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

## 📝 Question Endpoints

### GET /api/questions
Retrieve questions with filtering and pagination.

**Rate Limited**: Yes (general limiter)

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (default: 20)
- `status` (optional): Filter by status (published, draft, flagged)
- `difficulty` (optional): Filter by difficulty
- `category_id` (optional): Filter by category
- `search` (optional): Full-text search term

**Response**:
```json
{
  "questions": [
    {
      "id": "uuid",
      "title": "Question Title",
      "stem": "Question content...",
      "difficulty": "intermediate",
      "status": "published",
      "created_at": "2024-01-01T00:00:00Z",
      "answer_options": [
        {
          "id": "uuid",
          "text": "Option A",
          "is_correct": true,
          "explanation": "Explanation..."
        }
      ],
      "categories": [
        {
          "id": "uuid",
          "name": "Anatomic Pathology"
        }
      ],
      "tags": [
        {
          "id": "uuid",
          "name": "histology"
        }
      ]
    }
  ],
  "total": 150,
  "page": 1,
  "limit": 20
}
```

### POST /api/questions
Create a new question (admin/reviewer only).

**Rate Limited**: Yes (admin limiter)

**Request Body**:
```json
{
  "title": "Question Title",
  "stem": "Question content...",
  "teaching_point": "Key learning point...",
  "difficulty": "intermediate",
  "question_references": "Reference citations...",
  "question_options": [
    {
      "text": "Option A",
      "is_correct": true,
      "explanation": "Why this is correct..."
    }
  ],
  "category_id": "uuid",
  "tag_ids": ["uuid"],
  "image_ids": ["uuid"]
}
```

### PUT /api/questions/[id]
Update an existing question (admin/reviewer only).

**Rate Limited**: Yes (admin limiter)

**Request Body**: Same as POST /api/questions

### DELETE /api/questions/[id]
Delete a question (admin only).

**Rate Limited**: Yes (admin limiter)

## 📊 Analytics Endpoints

### GET /api/admin/analytics/questions
Get question performance analytics (admin only).

**Rate Limited**: Yes (admin limiter)

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (default: 20)
- `sort_by` (optional): Sort field (total_attempts, success_rate, difficulty_score)
- `sort_order` (optional): asc or desc (default: desc)
- `min_attempts` (optional): Minimum attempts threshold

**Response**:
```json
{
  "analytics": [
    {
      "question_id": "uuid",
      "question_title": "Question Title",
      "total_attempts": 150,
      "correct_attempts": 112,
      "success_rate": 0.7467,
      "difficulty_score": 2.5,
      "avg_time_spent": "00:01:30",
      "median_time_spent": "00:01:15",
      "flag_count": 2,
      "review_count": 1,
      "last_calculated_at": "2024-01-01T12:00:00Z"
    }
  ],
  "total": 50,
  "page": 1,
  "limit": 20
}
```

### POST /api/admin/analytics/recalculate
Recalculate analytics for all questions (admin only).

**Rate Limited**: Yes (admin limiter)

**Response**:
```json
{
  "success": true,
  "message": "Analytics recalculated for all questions",
  "questions_updated": 150
}
```

## 🎯 Quiz Endpoints

### POST /api/quiz/sessions
Create a new quiz session.

**Rate Limited**: Yes (quiz limiter)

**Request Body**:
```json
{
  "mode": "tutor",
  "time_limit": 3600,
  "question_count": 20,
  "filters": {
    "difficulty": ["intermediate", "advanced"],
    "category_ids": ["uuid"],
    "tag_ids": ["uuid"]
  }
}
```

**Response**:
```json
{
  "session_id": "uuid",
  "questions": [
    {
      "id": "uuid",
      "title": "Question Title",
      "stem": "Question content...",
      "question_options": [
        {
          "id": "uuid",
          "text": "Option A"
        }
      ]
    }
  ],
  "total_questions": 20,
  "time_limit": 3600
}
```

### POST /api/quiz/attempts
Submit an answer for a quiz question.

**Rate Limited**: Yes (quiz limiter)

**Request Body**:
```json
{
  "session_id": "uuid",
  "question_id": "uuid",
  "selected_option_id": "uuid",
  "time_spent": 45
}
```

**Response**:
```json
{
  "correct": true,
  "explanation": "Detailed explanation...",
  "teaching_point": "Key learning point...",
  "score": {
    "current": 15,
    "total": 20,
    "percentage": 75
  }
}
```

### GET /api/quiz/sessions/[id]/results
Get quiz session results.

**Rate Limited**: Yes (quiz limiter)

**Response**:
```json
{
  "session_id": "uuid",
  "score": {
    "correct": 18,
    "total": 20,
    "percentage": 90
  },
  "time_taken": 1800,
  "completed_at": "2024-01-01T00:00:00Z",
  "attempts": [
    {
      "question_id": "uuid",
      "selected_option_id": "uuid",
      "correct": true,
      "time_spent": 45
    }
  ]
}
```

## 🏷️ Category & Tag Endpoints

### GET /api/categories
Get all categories.

**Rate Limited**: Yes (general limiter)

**Response**:
```json
{
  "categories": [
    {
      "id": "uuid",
      "name": "Anatomic Pathology",
      "parent_id": null,
      "children": [
        {
          "id": "uuid",
          "name": "Cardiovascular Pathology",
          "parent_id": "uuid"
        }
      ]
    }
  ]
}
```

### GET /api/tags
Get all tags.

**Rate Limited**: Yes (general limiter)

**Response**:
```json
{
  "tags": [
    {
      "id": "uuid",
      "name": "histology",
      "color": "#3B82F6"
    }
  ]
}
```

## 🖼️ Image Endpoints

### GET /api/images
Get all images (admin only).

**Rate Limited**: Yes (admin limiter)

**Query Parameters**:
- `page` (optional): Page number
- `limit` (optional): Results per page

**Response**:
```json
{
  "images": [
    {
      "id": "uuid",
      "name": "Microscopic image",
      "url": "https://...",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

## 🚨 Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "Specific field error"
  }
}
```

### Common Error Codes

- `UNAUTHORIZED`: Authentication required
- `FORBIDDEN`: Insufficient permissions
- `VALIDATION_ERROR`: Invalid request data
- `NOT_FOUND`: Resource not found
- `RATE_LIMITED`: Too many requests
- `INTERNAL_ERROR`: Server error

### HTTP Status Codes

- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `429`: Too Many Requests
- `500`: Internal Server Error

## 📊 Response Formats

### Pagination

Paginated responses include metadata:

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5,
    "has_next": true,
    "has_prev": false
  }
}
```

### Timestamps

All timestamps are in ISO 8601 format (UTC):
```json
{
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T12:00:00.000Z"
}
```

## 🔗 Related Documentation

- [Security Guide](../development/SECURITY_GUIDE.md) - Authentication and security
- [Database Performance](../development/DATABASE_PERFORMANCE.md) - Query optimization
- [Developer Setup](../development/DEVELOPER_SETUP.md) - Local API testing
