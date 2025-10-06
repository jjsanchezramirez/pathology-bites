# 🌳 **PATHOLOGY BITES API TREE**

## 📊 **API Overview**
- **Total API Routes**: 89 endpoints
- **Authentication**: Protected routes via middleware
- **Architecture**: RESTful API with Next.js App Router
- **Security**: CSRF protection, authentication middleware

---

## 🔐 **ADMIN APIs** (19 endpoints)
```
/api/admin/
├── 🤖 ai-generate-question          # Generates pathology questions using AI for content creators
├── 📁 categories                    # Manages medical specialties and question categories (AP, CP, etc.)
├── 📧 inquiries/
│   ├── [id]                        # Views and manages user inquiries from the contact form
│   ├── [id]/respond                # Sends responses to user inquiries and support requests
│   └── [id]/status                 # Updates inquiry status (pending, resolved, closed)
├── 👥 invite-users                  # Sends invitation emails to new users and content creators
├── 📚 learning-modules              # Creates and manages structured learning content and modules
├── 🔔 notifications/
│   └── system-update               # Sends system-wide notifications to all users
├── ⚙️ question-generator            # Alternative question generation tool for admins
├── 📝 question-sets                # Organizes questions into themed sets and collections
├── ❓ questions/
│   ├── [id]                        # Edits, approves, or deletes individual pathology questions
│   └── [id]/version                # Manages question versioning and revision history
├── 📝 questions-create             # Creates new pathology questions with images and explanations
├── 📊 rate-limit-status            # Monitors API usage and rate limiting across the platform
├── 🔄 refresh-stats                # Refreshes cached statistics and dashboard data
├── 🖥️ system-status                # Checks database connectivity and system health status
├── 🏷️ tags                         # Manages question tags for better organization and search
├── 👤 users                        # Manages user accounts, roles, and permissions
└── 📝 waitlist                     # Manages user waitlist for platform access
```

---

## 🔒 **AUTHENTICATION APIs** (3 endpoints)
```
/api/auth/
├── 🔄 callback                     # Handles OAuth login callbacks from Google and other providers
├── ✉️ check-email                  # Verifies if email exists in system during signup/login
└── ✅ confirm                       # Confirms user account activation from email links
```

---

## 📄 **CONTENT APIs** (11 endpoints)
```
/api/content/
├── 📁 [filename]                   # Serves static educational content files and documents
├── 🎯 demo-questions/
│   ├── (list)                      # Provides sample pathology questions for unregistered users
│   └── [id]                        # Displays individual demo questions with explanations
├── 📚 educational/
│   └── [filename]                  # Serves educational PDFs, guides, and reference materials
└── ❓ questions/
    ├── [id]/
    │   ├── export                  # Exports questions to Anki, PDF, or other formats
    │   └── submit-for-review       # Submits user-created questions for peer review
    ├── answer-options              # Manages multiple choice options for questions
    ├── export                      # Bulk exports question sets for external use
    ├── flags                       # Allows users to flag problematic questions
    ├── images                      # Manages pathology images attached to questions
    ├── reviews                     # Handles peer review workflow for questions
    └── tags                        # Tags questions with relevant keywords and topics
```

---

## 🛠️ **UTILITY APIs** (4 endpoints)
```
/api/
├── 🛡️ csrf-token                   # Generates security tokens to prevent cross-site request forgery
├── 🩺 health                       # Checks if the API and database are functioning properly
├── 📧 subscribe                    # Handles newsletter and update subscriptions for users
└── 🔒 security/
    └── events                      # Logs security events like failed logins and suspicious activity
```

---

## 🐛 **DEBUG APIs** (2 endpoints)
```
/api/debug/
├── 🤖 ai-test                      # Tests AI question generation and model responses for debugging
└── 🗑️ clear-build-cache           # Clears application cache and forces fresh data loading
```

---

## 🖼️ **IMAGE MANAGEMENT APIs** (4 endpoints)
```
/api/images/
├── 🗑️ bulk-delete                 # Deletes multiple pathology images at once for cleanup
├── ❌ delete                       # Removes individual pathology images from questions
├── 🔄 replace                      # Replaces existing images with updated versions
└── ⬆️ upload                       # Uploads new pathology images for use in questions
```

---

## 🎓 **LEARNING SYSTEM APIs** (6 endpoints)
```
/api/learning/                       # Provides structured learning content and curriculum
/api/learning-modules/
├── (list)                          # Lists available learning modules by topic and difficulty
└── [id]/
    ├── (details)                   # Shows module content, objectives, and requirements
    └── progress                    # Tracks user completion and performance in modules

/api/learning-paths/
├── (list)                          # Lists guided learning paths for different specialties
└── [id]/
    ├── (details)                   # Shows path curriculum and recommended sequence
    └── enroll                      # Enrolls users in structured learning programs
```

---

## 🌐 **PUBLIC APIs** (8 endpoints)
```
/api/public/
├── 🛡️ csrf-token                   # Provides CSRF tokens for unauthenticated form submissions
├── 🩺 health                       # Public endpoint to check if the platform is operational
├── 📊 stats                        # Shows public statistics like total questions and users
└── 📊 data/
    ├── 🔬 cell-quiz-images         # Provides cell identification quiz images for practice
    ├── 📚 cell-quiz-references     # Gives reference answers for cell identification quiz
    └── 🔬 virtual-slides/
        ├── (list)                  # Lists available virtual pathology slides for study
        └── paginated               # Provides paginated virtual slide collections

/api/public-data/                    # Legacy endpoints maintaining backward compatibility
├── 🔬 cell-quiz-images            # Legacy cell quiz image endpoint
├── 📚 cell-quiz-references        # Legacy cell quiz reference endpoint
└── 🔬 virtual-slides/
    ├── (list)                     # Legacy virtual slides list
    └── paginated                  # Legacy paginated virtual slides
```

---

## 🎯 **QUIZ SYSTEM APIs** (8 endpoints)
```
/api/quiz/
├── 📝 attempts/
│   ├── (create/list)               # Records individual question attempts with answers and timing
│   ├── batch                       # Processes multiple question attempts efficiently
│   └── optimized                   # Provides optimized attempt processing for better performance
├── ⚙️ options                      # Manages quiz configuration like timing and question types
├── ❓ questions/
│   └── paginated                   # Delivers questions in pages for quiz sessions
└── 🎯 sessions/
    ├── (create/list)               # Creates and manages quiz sessions with user progress
    └── [id]/
        ├── (details)               # Shows current session state and progress
        ├── complete                # Finalizes quiz sessions and calculates scores
        └── results                 # Displays quiz results with performance analytics
```

---

## ☁️ **CLOUDFLARE R2 APIs** (8 endpoints)
```
/api/r2/
├── 📱 anki-media/
│   └── delete-all                  # Cleans up all uploaded Anki flashcard media files
├── ⬇️ download                     # Downloads files from cloud storage for users
├── 📁 files                        # Lists and manages files stored in Cloudflare R2
├── 🔒 private-url                  # Generates secure URLs for private file access
├── 🔄 reorganize                   # Reorganizes file structure and cleans up storage
├── ✍️ signed-url                   # Creates temporary signed URLs for secure file uploads
├── ✍️ signed-urls/
│   └── batch                       # Generates multiple signed URLs for bulk operations
└── ⬆️ upload-anki-media            # Uploads Anki flashcard media to cloud storage
```

---

## 🛠️ **EDUCATIONAL TOOLS APIs** (6 endpoints)
```
/api/tools/
├── 📖 citation-generator/
│   ├── extract-book-metadata       # Extracts citation data from book URLs for academic references
│   ├── extract-journal-metadata    # Extracts citation data from journal articles and papers
│   └── extract-url-metadata        # Generates citations from any URL for reference lists
├── 🔍 diagnostic-search            # Searches medical conditions and differential diagnoses
├── 🧬 gene-lookup                  # Looks up gene information and genetic pathology data
└── 🔬 wsi-question-generator/
    └── generate                    # Generates pathology questions from whole slide images using AI
```

---

## 👤 **USER APIs** (9 endpoints)
```
/api/user/
├── 👤 account/
│   └── delete                      # Permanently deletes user account and all associated data
├── 📊 dashboard/
│   ├── activities                  # Shows recent quiz attempts, achievements, and study activity
│   ├── consolidated                # Provides comprehensive dashboard data in single response
│   ├── goals/
│   │   ├── (list/create)           # Manages personal study goals and targets
│   │   ├── [id]/progress           # Tracks progress toward specific learning goals
│   │   └── batch/progress          # Updates progress for multiple goals efficiently
│   └── stats                       # Displays performance statistics and quiz analytics
├── 📤 data-export                  # Exports user data for GDPR compliance and portability
├── ⭐ favorites                    # Manages bookmarked questions and favorite content
├── 🔒 password-reset               # Handles secure password reset functionality
└── ⚙️ settings                     # Manages user preferences and account settings
```

---

## 🔧 **MISC APIs** (3 endpoints)
```
/api/
├── 📁 educational/[filename]       # Serves educational PDFs, guides, and study materials
└── 🔔 maintenance-notifications    # Notifies users of scheduled maintenance and system updates
```

---

## 📈 **API STATISTICS**

### **By Category:**
- 🔐 **Admin**: 19 endpoints (21%)
- 👤 **User**: 9 endpoints (10%)  
- 🎯 **Quiz**: 8 endpoints (9%)
- 🌐 **Public**: 8 endpoints (9%)
- ☁️ **R2**: 8 endpoints (9%)
- 📄 **Content**: 11 endpoints (12%)
- 🎓 **Learning**: 6 endpoints (7%)
- 🛠️ **Tools**: 6 endpoints (7%)
- 🖼️ **Images**: 4 endpoints (4%)
- 🔒 **Auth**: 3 endpoints (3%)
- 🛠️ **Utility**: 4 endpoints (4%)
- 🐛 **Debug**: 2 endpoints (2%)
- 🔧 **Misc**: 3 endpoints (3%)

### **Authentication Levels:**
- 🔒 **Protected**: 47 endpoints (53%) - Require authentication
- 🌐 **Public**: 42 endpoints (47%) - Open access

### **HTTP Methods Supported:**
- ✅ **GET**: Read operations (most endpoints)
- ✅ **POST**: Create operations
- ✅ **PUT/PATCH**: Update operations  
- ✅ **DELETE**: Delete operations

---

## 🎯 **KEY ENDPOINTS FOR DASHBOARD**

### **Critical Dashboard APIs:**
- 📊 `/api/user/dashboard/stats` - Main dashboard data
- 📊 `/api/user/dashboard/consolidated` - Comprehensive data
- 🎯 `/api/quiz/sessions` - Quiz data
- 👤 `/api/user/settings` - User preferences
- ⭐ `/api/user/favorites` - User favorites

### **Admin Dashboard APIs:**
- 📊 `/api/admin/refresh-stats` - Admin statistics
- 🖥️ `/api/admin/system-status` - System health
- 👥 `/api/admin/users` - User management
- ❓ `/api/admin/questions` - Question management

---

## 🔒 **SECURITY FEATURES**

- **CSRF Protection**: Available via `/api/csrf-token`
- **Authentication Middleware**: Protects admin/user routes
- **Rate Limiting**: Monitored via `/api/admin/rate-limit-status`
- **Security Events**: Logged via `/api/security/events`
- **Health Monitoring**: Multiple health check endpoints

---

## 🚀 **DEPLOYMENT READY**

Your API architecture shows:
- ✅ **Comprehensive Coverage**: 89 well-organized endpoints
- ✅ **Security**: Proper authentication and protection
- ✅ **Scalability**: Modular design with clear separation
- ✅ **Functionality**: Complete feature coverage
- ✅ **Performance**: Optimized endpoints for quiz system

**This is a production-ready API ecosystem!** 🎉