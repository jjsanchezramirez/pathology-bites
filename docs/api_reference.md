# API Reference

## Overview

The Pathology Bites API provides programmatic access to all platform functionality. All endpoints require authentication and implement role-based access control.

## Authentication

### JWT Token Authentication
All API endpoints require authentication via JWT tokens provided by Supabase Auth.

```bash
Authorization: Bearer <jwt_token>
```

### Obtaining Tokens
```typescript
// Client-side token retrieval
const { data: { session } } = await supabase.auth.getSession()
const token = session?.access_token

// Include in requests
const response = await fetch('/api/endpoint', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})
```

## Rate Limiting

| Endpoint Group | Limit | Window |
|----------------|-------|--------|
| Authentication | 10 requests | 15 minutes |
| General API | 100 requests | 1 minute |
| Admin API | 200 requests | 1 minute |
| Quiz API | 50 requests | 1 minute |

Rate limit headers included in responses:
- `X-RateLimit-Limit`: Maximum allowed
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Reset timestamp

## Error Handling

### Standard Error Format
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "Specific field error"
  },
  "timestamp": "2025-01-01T00:00:00Z"
}
```

### HTTP Status Codes
- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `429`: Too Many Requests
- `500`: Internal Server Error

## Authentication Endpoints

### POST /api/auth/login
User login with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "user",
    "status": "active"
  },
  "session": {
    "access_token": "jwt_token",
    "refresh_token": "refresh_token",
    "expires_at": 1640995200
  }
}
```

### POST /api/auth/signup
User registration with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "firstName": "John",
  "lastName": "Doe"
}
```

### POST /api/auth/logout
User logout (invalidates current session).

**Response:**
```json
{
  "message": "Logged out successfully"
}
```

### GET /api/auth/user
Get current user information.

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "user",
    "status": "active",
    "createdAt": "2025-01-01T00:00:00Z"
  }
}
```

## Question Management

### GET /api/questions
Retrieve questions with filtering and pagination.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (default: 20, max: 100)
- `status` (optional): Filter by status
- `difficulty` (optional): Filter by difficulty
- `category` (optional): Filter by category
- `search` (optional): Full-text search term

**Response:**
```json
{
  "questions": [
    {
      "id": "uuid",
      "title": "Question Title",
      "stem": "Question content...",
      "difficulty": "medium",
      "status": "published",
      "teachingPoint": "Key learning point",
      "createdAt": "2025-01-01T00:00:00Z",
      "answerOptions": [
        {
          "id": "uuid",
          "text": "Option A",
          "isCorrect": true,
          "explanation": "Explanation...",
          "orderIndex": 0
        }
      ],
      "category": {
        "id": "uuid",
        "name": "Anatomic Pathology"
      },
      "tags": [
        {
          "id": "uuid",
          "name": "histology"
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### POST /api/questions
Create a new question (admin/creator only).

**Request Body:**
```json
{
  "title": "Question Title",
  "stem": "Question content...",
  "difficulty": "medium",
  "teachingPoint": "Key learning point",
  "questionReferences": "Reference citations",
  "answerOptions": [
    {
      "text": "Option A",
      "isCorrect": true,
      "explanation": "Why this is correct",
      "orderIndex": 0
    }
  ],
  "categoryId": "uuid",
  "questionSetId": "uuid",
  "tagIds": ["uuid1", "uuid2"],
  "imageIds": ["uuid"]
}
```

**Response:**
```json
{
  "question": {
    "id": "uuid",
    "title": "Question Title",
    "status": "draft",
    "createdAt": "2025-01-01T00:00:00Z"
  }
}
```

### PUT /api/questions/[id]
Update an existing question.

**Permissions:**
- Creator: Can edit own draft questions
- Admin: Can edit any question (creates version for published)

**Request Body:** Same as POST `/api/questions`

### DELETE /api/questions/[id]
Delete a question (admin only).

**Response:**
```json
{
  "message": "Question deleted successfully"
}
```

### POST /api/questions/[id]/submit
Submit draft question for review.

**Response:**
```json
{
  "message": "Question submitted for review",
  "status": "under_review"
}
```

### GET /api/questions/[id]/versions
Get version history for a question (planned feature).

**Response:**
```json
{
  "versions": [
    {
      "id": "uuid",
      "versionMajor": 1,
      "versionMinor": 2,
      "versionPatch": 0,
      "versionString": "1.2.0",
      "changeType": "minor",
      "changeSummary": "Updated explanation for option B",
      "changedBy": "uuid",
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ]
}
```

### GET /api/questions/[id]/versions/compare
Compare two versions of a question (planned feature).

**Query Parameters:**
- `v1`: First version ID
- `v2`: Second version ID

**Response:**
```json
{
  "comparison": {
    "v1": {
      "version": "1.1.0",
      "title": "Original title",
      "stem": "Original question content..."
    },
    "v2": {
      "version": "1.2.0", 
      "title": "Updated title",
      "stem": "Updated question content..."
    },
    "changes": [
      {
        "field": "title",
        "type": "modified",
        "oldValue": "Original title",
        "newValue": "Updated title"
      }
    ]
  }
}
```

### POST /api/questions/[id]/versions/restore
Restore a previous version of a question (planned feature).

**Request Body:**
```json
{
  "versionId": "uuid",
  "createNewVersion": true
}
```

## Quiz System

### POST /api/quiz/sessions
Create a new quiz session.

**Request Body:**
```json
{
  "questionCount": 20,
  "timeLimit": 3600,
  "filters": {
    "difficulty": ["medium", "hard"],
    "categoryIds": ["uuid"],
    "tagIds": ["uuid"]
  }
}
```

**Response:**
```json
{
  "session": {
    "id": "uuid",
    "questionIds": ["uuid1", "uuid2"],
    "totalQuestions": 20,
    "timeLimit": 3600,
    "startedAt": "2025-01-01T00:00:00Z"
  },
  "questions": [
    {
      "id": "uuid",
      "title": "Question Title",
      "stem": "Question content...",
      "answerOptions": [
        {
          "id": "uuid",
          "text": "Option A"
        }
      ]
    }
  ]
}
```

### POST /api/quiz/attempts
Submit an answer for a quiz question.

**Request Body:**
```json
{
  "sessionId": "uuid",
  "questionId": "uuid",
  "selectedOptionId": "uuid",
  "timeSpent": 45
}
```

**Response:**
```json
{
  "correct": true,
  "explanation": "Detailed explanation...",
  "teachingPoint": "Key learning point",
  "currentScore": {
    "correct": 15,
    "total": 20,
    "percentage": 75
  }
}
```

### GET /api/quiz/sessions/[id]
Get quiz session details and results.

**Response:**
```json
{
  "session": {
    "id": "uuid",
    "userId": "uuid",
    "totalQuestions": 20,
    "timeTaken": 1800,
    "completedAt": "2025-01-01T00:00:00Z",
    "score": {
      "correct": 18,
      "total": 20,
      "percentage": 90
    }
  },
  "performance": {
    "byDifficulty": {
      "easy": { "correct": 5, "total": 5 },
      "medium": { "correct": 8, "total": 10 },
      "hard": { "correct": 5, "total": 5 }
    },
    "byCategory": {
      "Anatomic Pathology": { "correct": 12, "total": 15 }
    }
  }
}
```

## User Management

### GET /api/admin/users
Get all users (admin only).

**Query Parameters:**
- `page`, `limit`: Pagination
- `role`: Filter by user role
- `status`: Filter by user status
- `search`: Search by name/email

**Response:**
```json
{
  "users": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "user",
      "status": "active",
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

### PATCH /api/admin/users
Update user details (admin only).

**Request Body:**
```json
{
  "userId": "uuid",
  "updates": {
    "role": "creator",
    "status": "active",
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "role": "creator",
    "status": "active",
    "updatedAt": "2025-01-01T00:00:00Z"
  }
}
```

### DELETE /api/admin/users
Delete user account (admin only).

**Request Body:**
```json
{
  "userId": "uuid"
}
```

**Response:**
```json
{
  "message": "User deleted successfully"
}
```

## Review System

### GET /api/review-queue
Get questions pending review (admin/reviewer only).

**Query Parameters:**
- `type`: 'submissions' | 'flagged' | 'all'
- `page`, `limit`: Pagination

**Response:**
```json
{
  "items": [
    {
      "id": "uuid",
      "title": "Question Title",
      "reviewType": "new_submission",
      "priorityScore": 0,
      "createdAt": "2025-01-01T00:00:00Z",
      "creatorName": "John Doe",
      "question": {
        "id": "uuid",
        "title": "Question Title",
        "stem": "Question content...",
        "difficulty": "medium",
        "answerOptions": []
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50
  }
}
```

### POST /api/question-reviews
Submit a review decision (admin/reviewer only).

**Request Body:**
```json
{
  "questionId": "uuid",
  "action": "approve",
  "feedback": "Optional feedback for rejections"
}
```

**Response:**
```json
{
  "success": true,
  "action": "approve",
  "newStatus": "published",
  "versionCreated": "1.0.0"
}
```

### GET /api/question-reviews/[id]
Get review history for a question.

**Response:**
```json
{
  "reviews": [
    {
      "id": "uuid",
      "reviewerId": "uuid",
      "reviewerName": "Jane Smith",
      "action": "approve",
      "feedback": "Good question",
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ]
}
```

## Content Management

### GET /api/categories
Get all categories.

**Response:**
```json
{
  "categories": [
    {
      "id": "uuid",
      "name": "Anatomic Pathology",
      "parentId": null,
      "level": 0,
      "children": [
        {
          "id": "uuid",
          "name": "Cardiovascular Pathology",
          "parentId": "uuid",
          "level": 1
        }
      ]
    }
  ]
}
```

### GET /api/tags
Get all tags.

**Response:**
```json
{
  "tags": [
    {
      "id": "uuid",
      "name": "histology",
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ]
}
```

### GET /api/images
Get all images (admin/creator only).

**Query Parameters:**
- `category`: Filter by image category
- `unused`: Show only orphaned images

**Response:**
```json
{
  "images": [
    {
      "id": "uuid",
      "url": "https://example.com/image.jpg",
      "category": "microscopic",
      "description": "Image description",
      "fileSizeBytes": 1024,
      "createdBy": "uuid",
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ]
}
```

## Analytics

### GET /api/analytics/questions
Get question performance analytics (admin only).

**Query Parameters:**
- `page`, `limit`: Pagination
- `sortBy`: 'totalAttempts' | 'successRate' | 'difficultyScore'
- `sortOrder`: 'asc' | 'desc'
- `minAttempts`: Minimum attempts threshold

**Response:**
```json
{
  "analytics": [
    {
      "questionId": "uuid",
      "questionTitle": "Question Title",
      "totalAttempts": 150,
      "correctAttempts": 112,
      "successRate": 0.7467,
      "difficultyScore": 2.5,
      "avgTimeSpent": 90,
      "flagCount": 2,
      "lastCalculatedAt": "2025-01-01T12:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

### GET /api/analytics/dashboard
Get dashboard statistics (admin only).

**Response:**
```json
{
  "questions": {
    "total": 1500,
    "published": 1200,
    "draft": 200,
    "underReview": 50,
    "flagged": 25
  },
  "users": {
    "total": 5000,
    "active30Days": 1200
  },
  "quizActivity": {
    "totalSessions": 15000,
    "sessions7Days": 500
  },
  "content": {
    "totalImages": 800,
    "totalCategories": 31,
    "totalTags": 245
  }
}
```

## Utilities

### GET /api/health
System health check.

**Response:**
```json
{
  "status": "healthy",
  "database": {
    "connected": true,
    "responseTime": 45
  },
  "storage": {
    "usedMB": 250,
    "totalMB": 500,
    "percentage": 50
  },
  "timestamp": "2025-01-01T00:00:00Z"
}
```

### GET /api/csrf-token
Get CSRF token for form submissions.

**Response:**
```json
{
  "token": "csrf_token_string",
  "expires": 1640995200
}
```

## Data Formats

### Timestamps
All timestamps are in ISO 8601 format (UTC):
```json
{
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

### Pagination
Paginated responses include metadata:
```json
{
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### Enums

#### Question Status
- `draft`: Being created or edited
- `under_review`: Submitted for review
- `published`: Live and available
- `rejected`: Returned to creator

#### User Roles
- `admin`: Full system access
- `creator`: Content creation
- `reviewer`: Content review
- `user`: Quiz taking only

#### Difficulty Levels
- `easy`: Beginner level
- `medium`: Intermediate level
- `hard`: Advanced level

## Code Examples

### JavaScript/TypeScript
```typescript
// Create a new question
const createQuestion = async (questionData: CreateQuestionRequest) => {
  const { data: { session } } = await supabase.auth.getSession()
  
  const response = await fetch('/api/questions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session?.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(questionData)
  })
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  
  return response.json()
}

// Start a quiz session
const startQuiz = async (config: QuizConfig) => {
  const { data: { session } } = await supabase.auth.getSession()
  
  const response = await fetch('/api/quiz/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session?.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(config)
  })
  
  return response.json()
}
```

### Python
```python
import requests

class PathologyBitesAPI:
    def __init__(self, base_url: str, token: str):
        self.base_url = base_url
        self.headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
    
    def get_questions(self, page: int = 1, limit: int = 20):
        response = requests.get(
            f'{self.base_url}/api/questions',
            headers=self.headers,
            params={'page': page, 'limit': limit}
        )
        response.raise_for_status()
        return response.json()
    
    def create_question(self, question_data: dict):
        response = requests.post(
            f'{self.base_url}/api/questions',
            headers=self.headers,
            json=question_data
        )
        response.raise_for_status()
        return response.json()
```

---

*Last Updated: January 2025*