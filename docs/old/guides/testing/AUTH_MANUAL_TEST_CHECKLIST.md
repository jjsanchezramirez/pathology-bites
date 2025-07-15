# 🔍 Authentication Manual Testing Checklist

## Quick Test Setup

### 1. Start the Application
```bash
cd /Users/juansanchez/pathology-bites
npm run dev
```

### 2. Open Browser
Navigate to: `http://localhost:3000`

---

## ✅ **Basic Authentication Tests**

### **Login Flow**
- [ ] Navigate to `/login`
- [ ] Enter valid credentials and submit
- [ ] Verify successful login and redirect to dashboard
- [ ] Check that user info appears in UI
- [ ] Verify protected routes are accessible

### **Invalid Login**
- [ ] Enter wrong password
- [ ] Verify error message appears: "Please check your email and password"
- [ ] Ensure no redirect occurs
- [ ] Try multiple failed attempts (5+)
- [ ] Verify rate limiting message appears

### **Logout Flow**
- [ ] Click logout button/link
- [ ] Verify redirect to login page
- [ ] Try accessing protected route
- [ ] Confirm redirect back to login

---

## 🛡️ **Security Feature Tests**

### **CSRF Protection**
- [ ] Open browser DevTools → Network tab
- [ ] Submit login form
- [ ] Check request contains `csrf-token` field
- [ ] Verify `x-csrf-token` header is present

### **Session Security**
- [ ] Login successfully
- [ ] Open DevTools → Application → Session Storage
- [ ] Verify `session_fingerprint` exists
- [ ] Change User Agent in DevTools (Network conditions)
- [ ] Refresh page
- [ ] Look for security warning/risk indicator

### **Rate Limiting**
- [ ] Attempt 6+ failed logins quickly
- [ ] Verify "too many attempts" message
- [ ] Wait 30 seconds
- [ ] Verify login works again

---

## 🔄 **Error Handling Tests**

### **Network Errors**
- [ ] Open DevTools → Network tab
- [ ] Set to "Offline" mode
- [ ] Try to login
- [ ] Verify network error message
- [ ] Check for retry button
- [ ] Go back online and test retry

### **Form Validation**
- [ ] Submit empty login form
- [ ] Verify validation messages
- [ ] Enter invalid email format
- [ ] Verify email validation error
- [ ] Test password requirements (if signup)

---

## 📱 **Browser & Device Tests**

### **Different Browsers**
- [ ] Test in Chrome
- [ ] Test in Firefox
- [ ] Test in Safari
- [ ] Test in Edge

### **Mobile Testing**
- [ ] Open DevTools → Device simulation
- [ ] Test iPhone viewport
- [ ] Test Android viewport
- [ ] Verify forms work on mobile
- [ ] Check responsive design

---

## 🔍 **Security Validation Tests**

### **XSS Protection**
- [ ] Try entering `<script>alert('xss')</script>` in email field
- [ ] Verify script doesn't execute
- [ ] Check content is properly escaped

### **SQL Injection Protection**
- [ ] Try entering `admin'; DROP TABLE users; --` in email
- [ ] Verify proper error handling
- [ ] No database errors in console

### **Session Hijacking Protection**
- [ ] Login in Browser A
- [ ] Copy session cookies to Browser B
- [ ] Access protected route in Browser B
- [ ] Verify security warning appears

---

## ⚡ **Performance Tests**

### **Load Time**
- [ ] Measure login page load time (<2 seconds)
- [ ] Check auth API response time (<500ms)
- [ ] Verify no memory leaks after multiple logins

### **User Experience**
- [ ] Check loading states during auth
- [ ] Verify smooth transitions
- [ ] Test form responsiveness
- [ ] Check error message clarity

---

## 🎯 **Advanced Feature Tests**

### **Session Management**
- [ ] Login and wait 24+ hours (or manually expire)
- [ ] Try accessing protected route
- [ ] Verify session expired handling
- [ ] Test automatic token refresh

### **Multiple Sessions**
- [ ] Login in multiple browser tabs
- [ ] Logout from one tab
- [ ] Verify other tabs handle logout

### **Security Monitoring**
- [ ] Check for security debug panel (development)
- [ ] Verify security events are logged
- [ ] Test suspicious activity detection

---

## 🚨 **Red Flags to Watch For**

### **Security Issues**
- ❌ CSRF tokens missing from requests
- ❌ Session data visible in localStorage
- ❌ No security warnings for suspicious activity
- ❌ XSS scripts executing
- ❌ SQL injection causing errors

### **Performance Issues**
- ❌ Login taking >3 seconds
- ❌ Memory usage increasing with each login
- ❌ UI freezing during auth operations
- ❌ Network requests timing out

### **UX Issues**
- ❌ Confusing error messages
- ❌ No loading indicators
- ❌ Forms not working on mobile
- ❌ Broken redirects after login

---

## 📋 **Test Results Template**

```
Date: ___________
Tester: ___________
Browser: ___________
Device: ___________

Basic Authentication: ✅ / ❌
Security Features: ✅ / ❌
Error Handling: ✅ / ❌
Performance: ✅ / ❌
Mobile Compatibility: ✅ / ❌

Issues Found:
1. ________________
2. ________________
3. ________________

Overall Status: PASS / FAIL
```

---

## 🔧 **Quick Fixes for Common Issues**

### **If CSRF tokens are missing:**
1. Check `/api/csrf-token` endpoint works
2. Verify `useCSRFToken` hook is imported
3. Ensure forms use `CSRFForm` component

### **If session security isn't working:**
1. Check sessionStorage for fingerprint
2. Verify `sessionSecurity.validateSession()` is called
3. Check browser console for security events

### **If rate limiting isn't working:**
1. Check API rate limiter configuration
2. Verify error messages are displayed
3. Test with different IP addresses

### **If tests are failing:**
```bash
# Clear cache and restart
npm test -- --clearCache
npm run dev
```

This checklist should take about 30-45 minutes to complete thoroughly and will give you confidence that your authentication system is working correctly.
