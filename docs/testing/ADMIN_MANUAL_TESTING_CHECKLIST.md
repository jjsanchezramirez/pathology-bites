# 📋 Admin Manual Testing Checklist

## Quick Start
1. **Start Development Server**: `npm run dev`
2. **Open Admin Dashboard**: http://localhost:3000/admin/dashboard
3. **Test User Accounts**:
   - Admin: `admin@pathologybites.com`
   - Reviewer: `reviewer@pathologybites.com`
   - User: `user@pathologybites.com`

---

## ✅ Phase 1: Authentication & Access Control

### Test Admin User Access
- [ ] Login as admin user
- [ ] Verify redirect to `/admin/dashboard`
- [ ] Check all navigation items are visible
- [ ] Verify admin badge/indicator in sidebar
- [ ] Test logout functionality

### Test Reviewer User Access
- [ ] Login as reviewer user
- [ ] Verify redirect to `/admin/dashboard`
- [ ] Check only review-related navigation items visible
- [ ] Verify reviewer badge/indicator in sidebar
- [ ] Confirm admin-only items are hidden

### Test Regular User Access
- [ ] Login as regular user
- [ ] Verify redirect to `/dashboard` (not admin)
- [ ] Try accessing `/admin/dashboard` directly
- [ ] Confirm access is blocked/redirected

### Test Unauthenticated Access
- [ ] Logout completely
- [ ] Try accessing `/admin/dashboard`
- [ ] Verify redirect to login page
- [ ] Check redirect parameter is set correctly

---

## ✅ Phase 2: Dashboard Overview

### Dashboard Loading
- [ ] Dashboard loads without errors
- [ ] All stats cards display correctly
- [ ] Recent activity shows data
- [ ] Quick actions are populated
- [ ] System status shows current state

### Role-Based Dashboard Content
**As Admin:**
- [ ] See all 6 stats cards (Questions, Users, Images, Reviews, Inquiries, Reports)
- [ ] All quick actions visible
- [ ] User management stats shown

**As Reviewer:**
- [ ] See only 3 stats cards (Questions, Reviews, Reports)
- [ ] Only review-related quick actions shown
- [ ] No user/admin stats visible

### Dashboard Functionality
- [ ] Stats cards show correct numbers
- [ ] Quick action links work correctly
- [ ] Recent activity updates
- [ ] System status reflects actual state
- [ ] Loading states work properly

---

## ✅ Phase 3: Navigation & Layout

### Sidebar Navigation
**As Admin:**
- [ ] All 10 navigation items visible
- [ ] Dashboard, Questions, Review Drafts, Review Queue
- [ ] Question Management, Inquiries, Users, Images
- [ ] Analytics, Settings

**As Reviewer:**
- [ ] Only 4 navigation items visible
- [ ] Dashboard, Questions, Review Drafts, Review Queue
- [ ] Admin-only items hidden

### Navigation Functionality
- [ ] Active page highlighted correctly
- [ ] All links navigate to correct pages
- [ ] Sidebar collapse/expand works
- [ ] Mobile responsiveness
- [ ] Auth status shows correct role

---

## ✅ Phase 4: User Management (Admin Only)

### Users Table
- [ ] Navigate to `/admin/users`
- [ ] User list loads correctly
- [ ] Search functionality works
- [ ] Filter by role works
- [ ] Filter by status works
- [ ] Pagination works

### User Operations
- [ ] View user details
- [ ] Change user role (user ↔ reviewer ↔ admin)
- [ ] Change user status (active ↔ inactive)
- [ ] Confirm changes persist
- [ ] Test bulk operations (if available)

### Access Control
- [ ] Reviewer cannot access users page
- [ ] Regular user cannot access users page
- [ ] API endpoints return 403 for non-admins

---

## ✅ Phase 5: Question Management

### Questions List (Admin & Reviewer)
- [ ] Navigate to `/admin/questions`
- [ ] Questions list loads
- [ ] Search functionality
- [ ] Filter by category/status
- [ ] Pagination works

### Question Operations (Admin Only)
- [ ] Create new question (`/admin/questions/create`)
- [ ] Edit existing question
- [ ] Delete question
- [ ] Associate images with questions
- [ ] Set categories and tags

### Question Management Tools (Admin Only)
- [ ] Navigate to `/admin/question-management`
- [ ] Manage categories (create, edit, delete)
- [ ] Manage tags (create, edit, delete)
- [ ] Manage question sets (create, edit, delete)

---

## ✅ Phase 6: Review System

### Review Drafts (Admin & Reviewer)
- [ ] Navigate to `/admin/questions/review`
- [ ] Draft questions list loads
- [ ] Review individual questions
- [ ] Approve questions
- [ ] Reject questions with feedback
- [ ] Request revisions

### Review Queue (Admin & Reviewer)
- [ ] Navigate to `/admin/questions/review-queue`
- [ ] Flagged questions list loads
- [ ] Review flagged questions
- [ ] Resolve flags
- [ ] Update question status

### Review Workflow
- [ ] Create draft question (as admin)
- [ ] Review and approve (as reviewer)
- [ ] Flag published question
- [ ] Review and resolve flag

---

## ✅ Phase 7: Admin-Only Features

### Image Management
- [ ] Navigate to `/admin/images`
- [ ] Image gallery loads
- [ ] Upload new images
- [ ] Edit image metadata
- [ ] Delete images
- [ ] Search/filter images

### Inquiries Management
- [ ] Navigate to `/admin/inquiries`
- [ ] Inquiries list loads
- [ ] View inquiry details
- [ ] Respond to inquiries
- [ ] Update inquiry status

### Analytics
- [ ] Navigate to `/admin/analytics`
- [ ] Page loads (placeholder content)
- [ ] Verify admin-only access

### Settings
- [ ] Navigate to `/admin/settings`
- [ ] Settings form loads
- [ ] Update profile information
- [ ] Change password
- [ ] Update preferences
- [ ] Save changes

---

## ✅ Phase 8: Error Handling & Edge Cases

### Error States
- [ ] Test with no internet connection
- [ ] Test with slow network
- [ ] Test with invalid data
- [ ] Test API failures
- [ ] Test database connection issues

### Loading States
- [ ] All components show loading indicators
- [ ] Suspense boundaries work correctly
- [ ] No flash of unstyled content
- [ ] Graceful degradation

### Responsive Design
- [ ] Test on mobile devices
- [ ] Test on tablets
- [ ] Test on different screen sizes
- [ ] Sidebar behavior on mobile

---

## 🚨 Critical Issues to Watch For

### Security Issues
- [ ] Role escalation attempts
- [ ] Direct URL access bypassing permissions
- [ ] API endpoints accessible without proper roles
- [ ] Client-side role checking only

### Performance Issues
- [ ] Slow dashboard loading
- [ ] Large data sets causing timeouts
- [ ] Memory leaks in long sessions
- [ ] Inefficient database queries

### UI/UX Issues
- [ ] Confusing navigation
- [ ] Inconsistent styling
- [ ] Poor mobile experience
- [ ] Accessibility problems

---

## 📊 Testing Progress Tracker

### Phase Completion
- [ ] Phase 1: Authentication & Access Control
- [ ] Phase 2: Dashboard Overview
- [ ] Phase 3: Navigation & Layout
- [ ] Phase 4: User Management
- [ ] Phase 5: Question Management
- [ ] Phase 6: Review System
- [ ] Phase 7: Admin-Only Features
- [ ] Phase 8: Error Handling & Edge Cases

### Issues Found
| Issue | Severity | Component | Status |
|-------|----------|-----------|--------|
|       |          |           |        |

### Test Environment
- [ ] Development server running
- [ ] Test users created
- [ ] Sample data available
- [ ] Database accessible

---

## 🎯 Success Criteria

**Phase Complete When:**
- [ ] All checklist items completed
- [ ] No critical bugs found
- [ ] Role-based access working correctly
- [ ] All features functional
- [ ] Performance acceptable
- [ ] UI/UX meets standards

**Ready for Production When:**
- [ ] All phases completed
- [ ] Security audit passed
- [ ] Performance benchmarks met
- [ ] User acceptance testing completed
- [ ] Documentation updated
