# 🧪 Admin Components Testing Roadmap

## Overview
This roadmap provides a systematic approach to test all admin dashboard components, ensuring comprehensive coverage of functionality, role-based access, and user experience.

## Testing Strategy

### 🎯 Testing Levels
1. **Unit Tests** - Individual component functionality
2. **Integration Tests** - Component interactions and data flow
3. **E2E Tests** - Complete user workflows
4. **Manual Tests** - UI/UX validation and edge cases

### 👥 Test User Roles
- **Admin User**: Full access to all features
- **Reviewer User**: Limited access to review features only
- **Regular User**: Should be blocked from admin areas

---

## Phase 1: Core Infrastructure Testing

### 1.1 Authentication & Role-Based Access
**Priority**: 🔴 Critical
**Estimated Time**: 2-3 hours

#### Unit Tests
- [ ] `useUserRole` hook functionality
- [ ] Role permission checking logic
- [ ] RoleGuard component behavior

#### Integration Tests
- [ ] Middleware role checking
- [ ] API endpoint access control
- [ ] Role-based UI rendering

#### Manual Tests
- [ ] Login as admin → verify full access
- [ ] Login as reviewer → verify limited access
- [ ] Login as user → verify admin redirect blocked
- [ ] Test role switching scenarios

**Test Commands:**
```bash
npm test -- src/shared/hooks/__tests__/use-user-role.test.ts
npm test -- src/shared/services/__tests__/middleware.test.ts
npm test -- src/shared/components/auth
```

### 1.2 Layout & Navigation
**Priority**: 🔴 Critical
**Estimated Time**: 1-2 hours

#### Unit Tests
- [ ] Sidebar component rendering
- [ ] Navigation item filtering by role
- [ ] Responsive layout behavior

#### Manual Tests
- [ ] Sidebar collapse/expand functionality
- [ ] Navigation highlighting for active pages
- [ ] Mobile responsiveness
- [ ] Theme switching (if applicable)

**Test Commands:**
```bash
npm test -- src/shared/components/layout
```

---

## Phase 2: Dashboard Components Testing

### 2.1 Main Dashboard
**Priority**: 🔴 Critical
**Estimated Time**: 2-3 hours

#### Components to Test
- [ ] **StatsCards** - Role-based metric display
- [ ] **RecentActivityCard** - Activity feed
- [ ] **QuickActionsCard** - Role-filtered actions
- [ ] **SystemStatus** - Health monitoring

#### Unit Tests
- [ ] Dashboard service data fetching
- [ ] Stats calculation accuracy
- [ ] Role-based card filtering
- [ ] Loading state handling

#### Integration Tests
- [ ] Dashboard data flow
- [ ] Suspense boundary behavior
- [ ] Error state handling

#### Manual Tests
- [ ] Dashboard loads with correct data
- [ ] Stats update in real-time
- [ ] Quick actions work correctly
- [ ] System status shows accurate info
- [ ] Role-based content filtering

**Test Commands:**
```bash
npm test -- src/features/dashboard
npm test -- src/shared/components/layout/dashboard
```

**Manual Test URL**: `/admin/dashboard`

---

## Phase 3: User Management Testing

### 3.1 Users Table & Management
**Priority**: 🟡 High
**Estimated Time**: 3-4 hours

#### Components to Test
- [ ] **UsersTable** - User listing and management
- [ ] **User role modification**
- [ ] **User status management**
- [ ] **Search and filtering**

#### Unit Tests
- [ ] User data fetching and display
- [ ] Role change functionality
- [ ] Status update operations
- [ ] Search/filter logic

#### Integration Tests
- [ ] API integration for user operations
- [ ] Real-time updates
- [ ] Pagination behavior

#### Manual Tests
- [ ] User list loads correctly
- [ ] Search functionality works
- [ ] Role changes persist
- [ ] Status updates work
- [ ] Pagination functions properly
- [ ] Admin-only access enforced

**Test Commands:**
```bash
npm test -- src/features/users
npm test -- src/app/api/admin/users
```

**Manual Test URL**: `/admin/users`

---

## Phase 4: Question Management Testing

### 4.1 Questions Table
**Priority**: 🟡 High
**Estimated Time**: 4-5 hours

#### Components to Test
- [ ] **QuestionsTable** - Question listing
- [ ] **QuestionForm** - Create/edit questions
- [ ] **Question filtering and search**
- [ ] **Bulk operations**

#### Unit Tests
- [ ] Question data rendering
- [ ] Form validation
- [ ] Filter/search logic
- [ ] CRUD operations

#### Integration Tests
- [ ] Question creation workflow
- [ ] Question editing workflow
- [ ] Image associations
- [ ] Category/tag management

#### Manual Tests
- [ ] Question list displays correctly
- [ ] Create new question works
- [ ] Edit existing question works
- [ ] Delete question works
- [ ] Search/filter functions
- [ ] Image upload/association
- [ ] Category/tag assignment

**Test Commands:**
```bash
npm test -- src/features/questions
npm test -- src/app/api/admin/questions
```

**Manual Test URLs**: 
- `/admin/questions`
- `/admin/questions/create`
- `/admin/questions/[id]/edit`

### 4.2 Question Management (Categories, Tags, Sets)
**Priority**: 🟡 High
**Estimated Time**: 3-4 hours

#### Components to Test
- [ ] **CategoriesManagement** - Category CRUD
- [ ] **TagsManagement** - Tag CRUD
- [ ] **SetsManagement** - Question set CRUD

#### Manual Tests
- [ ] Create/edit/delete categories
- [ ] Create/edit/delete tags
- [ ] Create/edit/delete question sets
- [ ] Hierarchical category structure
- [ ] Admin-only access enforced

**Manual Test URL**: `/admin/question-management`

---

## Phase 5: Review System Testing

### 5.1 Review Workflows
**Priority**: 🔴 Critical
**Estimated Time**: 4-5 hours

#### Components to Test
- [ ] **DraftQuestionsTable** - Draft review interface
- [ ] **ReviewQueueTable** - Flagged questions
- [ ] **QuestionReviewDialog** - Review interface
- [ ] **QuestionFlagDialog** - Flagging interface

#### Unit Tests
- [ ] Review action processing
- [ ] Status change logic
- [ ] Reviewer permission checking

#### Integration Tests
- [ ] Complete review workflow
- [ ] Question status transitions
- [ ] Notification system

#### Manual Tests
- [ ] Review draft questions
- [ ] Approve/reject questions
- [ ] Flag published questions
- [ ] Review flagged questions
- [ ] Reviewer access works correctly

**Test Commands:**
```bash
npm test -- src/app/api/question-reviews
npm test -- src/app/api/question-flags
```

**Manual Test URLs**:
- `/admin/questions/review`
- `/admin/questions/review-queue`

---

## Phase 6: Content Management Testing

### 6.1 Image Management
**Priority**: 🟡 Medium
**Estimated Time**: 2-3 hours

#### Manual Tests
- [ ] Image upload functionality
- [ ] Image gallery display
- [ ] Image search/filter
- [ ] Image deletion
- [ ] Image metadata editing
- [ ] Admin-only access

**Manual Test URL**: `/admin/images`

### 6.2 Inquiries Management
**Priority**: 🟡 Medium
**Estimated Time**: 2-3 hours

#### Manual Tests
- [ ] Inquiry list display
- [ ] Inquiry details view
- [ ] Response functionality
- [ ] Status management
- [ ] Admin-only access

**Manual Test URL**: `/admin/inquiries`

---

## Phase 7: System Features Testing

### 7.1 Analytics Dashboard
**Priority**: 🟢 Low
**Estimated Time**: 1-2 hours

#### Manual Tests
- [ ] Analytics page loads
- [ ] Placeholder content displays
- [ ] Admin-only access
- [ ] Future chart areas identified

**Manual Test URL**: `/admin/analytics`

### 7.2 Settings Management
**Priority**: 🟡 Medium
**Estimated Time**: 2-3 hours

#### Manual Tests
- [ ] Settings form loads
- [ ] Profile settings update
- [ ] Password change functionality
- [ ] Notification preferences
- [ ] Dashboard customization
- [ ] Admin-only access

**Manual Test URL**: `/admin/settings`

---

## Phase 8: End-to-End Workflow Testing

### 8.1 Complete Admin Workflows
**Priority**: 🔴 Critical
**Estimated Time**: 3-4 hours

#### E2E Test Scenarios
- [ ] **Admin Login → Dashboard → Create Question → Review → Publish**
- [ ] **Reviewer Login → Review Queue → Approve Question**
- [ ] **Admin User Management → Role Change → Access Verification**
- [ ] **Question Flagging → Review → Resolution**

#### Test Commands
```bash
npm run test:e2e -- --grep "admin"
```

---

## Testing Schedule

### Week 1: Foundation (Phases 1-2)
- **Day 1**: Authentication & Role-Based Access
- **Day 2**: Layout & Navigation + Dashboard Components

### Week 2: Core Features (Phases 3-5)
- **Day 3**: User Management
- **Day 4-5**: Question Management
- **Day 6**: Review System

### Week 3: Additional Features (Phases 6-8)
- **Day 7**: Content Management (Images, Inquiries)
- **Day 8**: System Features (Analytics, Settings)
- **Day 9**: End-to-End Workflows
- **Day 10**: Bug fixes and optimization

---

## Test Data Requirements

### Users
- Admin user: `admin@pathologybites.com`
- Reviewer user: `reviewer@pathologybites.com`
- Regular user: `user@pathologybites.com`

### Questions
- Draft questions for review testing
- Published questions for flagging testing
- Questions with various categories/tags

### Images
- Sample pathology images
- Various file formats and sizes

---

## Success Criteria

### ✅ Phase Complete When:
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All manual test scenarios completed
- [ ] Role-based access verified
- [ ] No critical bugs found
- [ ] Performance acceptable
- [ ] UI/UX meets standards

### 🚨 Blockers to Address:
- Authentication failures
- Role permission errors
- Data loading issues
- API endpoint failures
- UI rendering problems

---

## Tools & Commands

### Quick Start Testing Script
We've created a comprehensive testing script to run tests systematically:

```bash
# Make script executable (first time only)
chmod +x scripts/test-admin-components.sh

# Run specific test phases
./scripts/test-admin-components.sh phase 1        # Authentication tests
./scripts/test-admin-components.sh phase dashboard # Dashboard tests
./scripts/test-admin-components.sh phase all      # All tests

# Run specific component tests
./scripts/test-admin-components.sh component sidebar   # Sidebar component
./scripts/test-admin-components.sh component stats     # Stats cards
./scripts/test-admin-components.sh component role-hook # useUserRole hook

# Generate coverage report
./scripts/test-admin-components.sh coverage

# Get help
./scripts/test-admin-components.sh help
```

### Manual Testing Commands
```bash
# All admin tests
npm test -- src/features/admin src/shared/components/layout src/shared/hooks/use-user-role

# Specific component tests
npm test -- src/features/users/components/users-table.test.tsx

# E2E tests
npm run test:e2e -- --grep "admin dashboard"

# Coverage report
npm test -- --coverage src/features/admin
```

### Development Server
```bash
npm run dev
# Test at: http://localhost:3000/admin/dashboard
```

### Test Execution Order
Follow this order for systematic testing:

1. **Start Development Server**: `npm run dev`
2. **Phase 1 - Authentication**: `./scripts/test-admin-components.sh phase 1`
3. **Phase 2 - Layout**: `./scripts/test-admin-components.sh phase 2`
4. **Phase 3 - Dashboard**: `./scripts/test-admin-components.sh phase 3`
5. **Phase 4 - Users**: `./scripts/test-admin-components.sh phase 4`
6. **Phase 5 - Questions**: `./scripts/test-admin-components.sh phase 5`
7. **Phase 6 - Review**: `./scripts/test-admin-components.sh phase 6`
8. **Phase 7 - E2E**: `./scripts/test-admin-components.sh phase 7`

This roadmap ensures systematic testing of all admin components with clear priorities, time estimates, and success criteria.
