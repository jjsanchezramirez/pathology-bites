# 🧪 Authentication System Testing Guide

## Quick Start Testing

### 1. Run All Auth Tests
```bash
# Run all authentication tests
npm test -- src/features/auth --verbose

# Run with coverage
npm test -- src/features/auth --coverage

# Run specific test files
npm test -- src/features/auth/utils/__tests__/error-handling.test.ts
npm test -- src/features/auth/utils/__tests__/session-security.test.ts
npm test -- src/features/auth/hooks/__tests__/use-csrf-token.test.ts
```

### 2. Start Development Server
```bash
# Start the development server
npm run dev

# Open in browser
open http://localhost:3000
```

## Manual Testing Scenarios

### 🔐 **Authentication Flow Testing**

#### **1. Basic Login/Logout**
1. **Navigate to login page**: `http://localhost:3000/login`
2. **Test valid credentials**:
   - Enter valid email/password
   - Verify successful login and redirect
   - Check that user is authenticated
3. **Test invalid credentials**:
   - Enter wrong password
   - Verify error message appears
   - Ensure no redirect occurs
4. **Test logout**:
   - Click logout button
   - Verify redirect to login page
   - Ensure session is cleared

#### **2. Signup Flow**
1. **Navigate to signup**: `http://localhost:3000/signup`
2. **Test form validation**:
   - Try weak passwords
   - Try invalid email formats
   - Verify validation messages
3. **Test successful signup**:
   - Enter valid details
   - Check email verification flow
   - Verify account creation

#### **3. Password Reset**
1. **Navigate to forgot password**: `http://localhost:3000/forgot-password`
2. **Test email sending**:
   - Enter valid email
   - Check for confirmation message
3. **Test reset link**:
   - Check email for reset link
   - Follow link and reset password
   - Verify new password works

### 🛡️ **Security Feature Testing**

#### **1. CSRF Protection**
1. **Open browser dev tools** → Network tab
2. **Submit login form**:
   - Verify `csrf-token` field in form data
   - Check for `x-csrf-token` header in requests
3. **Test CSRF failure**:
   - Manually remove CSRF token from form
   - Submit form and verify error message

#### **2. Session Security**
1. **Login successfully**
2. **Open browser dev tools** → Application → Session Storage
3. **Check for session fingerprint**:
   - Look for `session_fingerprint` key
   - Verify it contains device data
4. **Test security warnings**:
   - Change browser user agent (dev tools)
   - Refresh page and check for security warnings

#### **3. Rate Limiting**
1. **Attempt multiple failed logins** (5+ times quickly)
2. **Verify rate limiting**:
   - Check for "too many attempts" message
   - Verify temporary lockout
3. **Test recovery**:
   - Wait for rate limit to reset
   - Verify normal login works again

### 🔄 **Error Handling Testing**

#### **1. Network Errors**
1. **Disconnect internet** or use dev tools to simulate offline
2. **Try to login**:
   - Verify network error message
   - Check for retry button
3. **Reconnect and retry**:
   - Click retry button
   - Verify successful recovery

#### **2. Server Errors**
1. **Use dev tools** → Network → Block specific requests
2. **Block auth API calls**:
   - Try to login
   - Verify server error handling
3. **Unblock and test recovery**

#### **3. Session Expiration**
1. **Login successfully**
2. **Manually expire session** (clear cookies or wait)
3. **Try to access protected route**:
   - Verify redirect to login
   - Check for session expired message

## Browser Testing

### **Cross-Browser Compatibility**
Test in multiple browsers:
- ✅ Chrome (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Edge (latest)

### **Mobile Testing**
Test responsive behavior:
- ✅ iOS Safari
- ✅ Android Chrome
- ✅ Mobile form interactions

## Performance Testing

### **1. Load Testing**
```bash
# Install artillery for load testing
npm install -g artillery

# Create load test config
cat > auth-load-test.yml << EOF
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10
scenarios:
  - name: "Login flow"
    flow:
      - get:
          url: "/login"
      - post:
          url: "/api/auth/login"
          json:
            email: "test@example.com"
            password: "password123"
EOF

# Run load test
artillery run auth-load-test.yml
```

### **2. Memory Leak Testing**
1. **Open Chrome DevTools** → Performance
2. **Start recording**
3. **Perform multiple login/logout cycles** (20+ times)
4. **Check memory usage**:
   - Look for memory leaks
   - Verify cleanup on logout

## Security Testing

### **1. OWASP ZAP Testing**
```bash
# Install OWASP ZAP
# Download from: https://www.zaproxy.org/download/

# Run automated security scan
zap-cli quick-scan --self-contained http://localhost:3000/login
```

### **2. Manual Security Tests**

#### **SQL Injection Testing**
1. **Try SQL injection in login form**:
   - Email: `admin'; DROP TABLE users; --`
   - Password: `' OR '1'='1`
2. **Verify protection**:
   - Should show validation error
   - No database errors in console

#### **XSS Testing**
1. **Try XSS payloads**:
   - Email: `<script>alert('xss')</script>`
   - Name: `<img src=x onerror=alert('xss')>`
2. **Verify sanitization**:
   - Scripts should not execute
   - Content should be escaped

#### **Session Hijacking Testing**
1. **Login in one browser**
2. **Copy session cookies to another browser**
3. **Verify session fingerprinting**:
   - Should detect different browser
   - Should show security warning

## Automated Testing Commands

### **Unit Tests**
```bash
# Run error handling tests
npm test -- src/features/auth/utils/__tests__/error-handling.test.ts

# Run session security tests
npm test -- src/features/auth/utils/__tests__/session-security.test.ts

# Run CSRF tests
npm test -- src/features/auth/hooks/__tests__/use-csrf-token.test.ts
```

### **Integration Tests**
```bash
# Run auth integration tests
npm test -- src/features/auth/__tests__/auth-integration.test.tsx

# Run component tests
npm test -- src/features/auth/components
```

### **E2E Tests (if available)**
```bash
# Run Playwright/Cypress tests
npm run test:e2e

# Run specific auth E2E tests
npm run test:e2e -- --grep "authentication"
```

## Test Data Setup

### **Create Test Users**
```sql
-- In Supabase SQL editor
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at)
VALUES 
  ('test-user-1', 'test@example.com', crypt('password123', gen_salt('bf')), now()),
  ('admin-user', 'admin@example.com', crypt('admin123', gen_salt('bf')), now());

INSERT INTO public.users (id, email, role, first_name, last_name)
VALUES 
  ('test-user-1', 'test@example.com', 'user', 'Test', 'User'),
  ('admin-user', 'admin@example.com', 'admin', 'Admin', 'User');
```

### **Test Environment Variables**
```bash
# .env.test
NEXT_PUBLIC_SUPABASE_URL=your_test_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_test_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_test_service_key
```

## Debugging Tests

### **Common Issues**

1. **Tests timing out**:
   ```bash
   # Increase timeout
   npm test -- --testTimeout=10000
   ```

2. **Mock issues**:
   ```bash
   # Clear Jest cache
   npm test -- --clearCache
   ```

3. **Environment issues**:
   ```bash
   # Check environment variables
   npm test -- --verbose
   ```

### **Debug Mode**
```bash
# Run tests in debug mode
node --inspect-brk node_modules/.bin/jest src/features/auth

# Run single test file in debug
npm test -- src/features/auth/utils/__tests__/error-handling.test.ts --runInBand
```

## Test Results Interpretation

### **Expected Results**
- ✅ All unit tests should pass (46+ tests)
- ✅ Security tests should show no vulnerabilities
- ✅ Performance tests should show <100ms response times
- ✅ Manual tests should demonstrate proper error handling

### **Red Flags**
- ❌ Any security test failures
- ❌ Memory leaks in performance tests
- ❌ CSRF token missing from requests
- ❌ Session security warnings not appearing

## Continuous Testing

### **Pre-commit Testing**
```bash
# Add to package.json scripts
"pre-commit": "npm test -- src/features/auth --passWithNoTests"
```

### **CI/CD Integration**
```yaml
# .github/workflows/auth-tests.yml
name: Auth Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm test -- src/features/auth --coverage
```

This comprehensive testing approach ensures your authentication system is secure, reliable, and performs well under various conditions.
