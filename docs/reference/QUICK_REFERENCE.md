# Pathology Bites Quick Reference

## 🚀 Essential Links

### For New Developers
1. **[Developer Setup](./guides/DEVELOPER_SETUP.md)** - Get started quickly
2. **[Database Schema](./architecture/DATABASE_SCHEMA.md)** - Understand the data structure
3. **[GitHub Flow Workflow](./guides/GITHUB_FLOW_WORKFLOW.md)** - Development process
4. **[Security Guide](./guides/SECURITY_GUIDE.md)** - Security best practices

### For System Administrators
1. **[Database Comprehensive Summary](../architecture/DATABASE_COMPREHENSIVE_SUMMARY.md)** - Complete database overview
2. **[Supabase Security Fixes](../security/summaries/SUPABASE_SECURITY_FIXES_SUMMARY.md)** - Security implementation status
3. **[User Management](./features/USER_MANAGEMENT.md)** - Role-based access control
4. **[Deployment Checklist](./guides/BYPASS_DEPLOYMENT_CHECKLIST.md)** - Pre-deployment validation

### For Content Creators
1. **[Question JSON Import](./api/question-json-import.md)** - Import question format
2. **[Question Review Workflow](./architecture/QUESTION_REVIEW_WORKFLOW.md)** - Content approval process
3. **[Image Management System](./features/IMAGE_MANAGEMENT_SYSTEM.md)** - Image handling

---

## 🔒 Security Overview

### Current Security Status: ✅ FULLY SECURED
- **21 Tables**: All with Row Level Security enabled
- **58 RLS Policies**: Granular access control
- **19 Functions**: All with secure search paths
- **6 Views**: All using SECURITY INVOKER
- **4-Role System**: Admin, Creator, Reviewer, User

### Key Security Features
- **Authentication**: Supabase Auth with JWT tokens
- **Authorization**: Role-based access control (RBAC)
- **Data Protection**: RLS policies on every table
- **Audit Logging**: Comprehensive activity tracking
- **Function Security**: Search path injection protection

---

## 👥 User Roles & Permissions

### Admin
- **Full system access** - All tables and functions
- **User management** - Create, update, delete users
- **Direct editing** - Can edit published questions
- **System monitoring** - Access to audit logs and analytics

### Creator
- **Question creation** - Create and edit own draft questions
- **Content submission** - Submit questions for review
- **Image management** - Upload and manage images
- **Version access** - View own question versions

### Reviewer
- **Question review** - Approve/reject submitted questions
- **Analytics access** - View question performance data
- **Flag management** - Handle flagged content
- **Version history** - Access pending question versions

### User
- **Quiz taking** - Access published questions for quizzes
- **Performance tracking** - View own quiz results and analytics
- **Question flagging** - Report problematic content
- **Profile management** - Update own profile information

---

## 🗄️ Database Quick Facts

### Tables (21 total)
- **Core**: questions, question_options, users, quiz_sessions
- **Content**: images, categories, tags, sets
- **Workflow**: question_reviews, question_flags, question_versions
- **Analytics**: question_analytics, performance_analytics
- **System**: audit_logs, notification_states

### Key Relationships
- **Questions** → Options (1:many), Images (many:many), Tags (many:many)
- **Users** → Quiz Sessions (1:many), Questions (1:many as creator)
- **Quiz Sessions** → Attempts (1:many)
- **Images** → Question Images (1:many)

### Performance Features
- **Search Vectors**: Full-text search on questions and images
- **Indexes**: 58 strategic indexes for optimal performance
- **Analytics**: Real-time question and user performance tracking

---

## 🔧 Development Workflow

### Standard Process
1. **Create Feature Branch**: `git checkout -b feature/your-feature`
2. **Develop & Test**: Follow TDD practices
3. **Lint & Build**: `npm run lint && npm run build`
4. **Create PR**: Submit for review
5. **Deploy**: After approval and merge

### Testing Requirements
- **Unit Tests**: Jest + Testing Library
- **Integration Tests**: API endpoint testing
- **Security Tests**: RLS policy validation
- **Manual Testing**: UI/UX validation

### Code Quality
- **TypeScript**: Strict type checking
- **ESLint**: Code style enforcement
- **Prettier**: Code formatting
- **Husky**: Pre-commit hooks

---

## 📡 API Quick Reference

### Authentication
- **POST** `/api/auth/login` - User login
- **POST** `/api/auth/signup` - User registration
- **GET** `/api/auth/callback` - OAuth callback

### Questions
- **GET** `/api/demo-questions` - Public demo questions
- **POST** `/api/admin/questions` - Create question (admin/creator)
- **PUT** `/api/admin/questions/[id]` - Update question
- **GET** `/api/question-flags` - Get flagged questions

### Quiz System
- **POST** `/api/quiz/sessions` - Start quiz session
- **POST** `/api/quiz/attempts` - Submit quiz attempt
- **GET** `/api/quiz/stats` - Get quiz statistics

---

## 🚨 Common Issues & Solutions

### Database Connection Issues
- Check environment variables in `.env.local`
- Verify Supabase project settings
- Ensure RLS policies allow access

### Authentication Problems
- Clear browser cookies and localStorage
- Check JWT token expiration
- Verify user role assignments

### Permission Denied Errors
- Check RLS policies for the table
- Verify user role has required permissions
- Review function security settings

### Performance Issues
- Check database indexes
- Review query patterns
- Monitor Supabase dashboard

---

## 📞 Getting Help

### Documentation
- **Main README**: [docs/README.md](../README.md)
- **Architecture**: [architecture/](../architecture/)
- **Guides**: [guides/](../guides/)

### Debugging
- **Methodology**: [guides/DEBUGGING_METHODOLOGY.md](../guides/DEBUGGING_METHODOLOGY.md)
- **Testing**: [guides/testing/](../guides/testing/)
- **Security**: [SUPABASE_SECURITY_FIXES_SUMMARY.md](../security/summaries/SUPABASE_SECURITY_FIXES_SUMMARY.md)

### Development
- **Setup**: [guides/DEVELOPER_SETUP.md](../guides/DEVELOPER_SETUP.md)
- **Workflow**: [guides/GITHUB_FLOW_WORKFLOW.md](../guides/GITHUB_FLOW_WORKFLOW.md)
- **API**: [api/api-documentation.md](../api/api-documentation.md)

---

*Quick Reference - Last Updated: January 4, 2025*
