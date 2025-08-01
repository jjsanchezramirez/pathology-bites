# Tests Directory

This directory contains all testing files for the Pathology Bites application, including end-to-end tests, integration tests, and test utilities.

## Directory Structure

```
tests/
├── auth.spec.ts           # Authentication end-to-end tests
└── README.md             # This file
```

## Test Types

### End-to-End Tests (E2E)
End-to-end tests that simulate real user interactions with the application using Playwright.

#### `auth.spec.ts`
Comprehensive authentication flow testing including:
- **User Registration**: Sign-up process validation
- **User Login**: Login functionality and session management
- **Password Reset**: Password recovery workflow
- **Email Verification**: Email confirmation process
- **Session Management**: Authentication state persistence
- **Access Control**: Role-based access verification

## Test Configuration

### Playwright Configuration
Tests are configured through `playwright.config.ts` in the project root:
- **Test Directory**: `./tests`
- **Browsers**: Chrome, Firefox, Safari (WebKit)
- **Parallel Execution**: Enabled for faster test runs
- **Retry Logic**: Configured for CI/CD environments
- **Screenshots**: Captured on test failures
- **Video Recording**: Available for debugging

### Environment Setup
Tests require proper environment configuration:
- **Test Database**: Separate database instance for testing
- **Environment Variables**: Test-specific configuration
- **Authentication**: Test user accounts and credentials
- **API Endpoints**: Test environment URLs

## Running Tests

### Prerequisites
1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Install Playwright Browsers**:
   ```bash
   npx playwright install
   ```

3. **Environment Setup**:
   ```bash
   cp .env.example .env.test
   # Configure test environment variables
   ```

### Running E2E Tests

#### All Tests
```bash
# Run all end-to-end tests
npx playwright test

# Run tests in headed mode (visible browser)
npx playwright test --headed

# Run tests in debug mode
npx playwright test --debug
```

#### Specific Tests
```bash
# Run authentication tests only
npx playwright test auth.spec.ts

# Run specific test by name
npx playwright test --grep "user login"
```

#### Browser-Specific Tests
```bash
# Run tests in Chrome only
npx playwright test --project=chromium

# Run tests in Firefox only
npx playwright test --project=firefox

# Run tests in Safari only
npx playwright test --project=webkit
```

### Test Reports
```bash
# Generate and view HTML report
npx playwright show-report

# Generate test results in different formats
npx playwright test --reporter=json
npx playwright test --reporter=junit
```

## Test Development

### Writing New Tests
1. **Create Test File**: Add new `.spec.ts` files in the tests directory
2. **Follow Patterns**: Use existing test patterns and page object models
3. **Test Isolation**: Ensure tests are independent and can run in any order
4. **Data Management**: Use test-specific data and clean up after tests

### Best Practices
- **Page Object Model**: Use page objects for reusable UI interactions
- **Test Data**: Use factories or fixtures for consistent test data
- **Assertions**: Use Playwright's built-in assertions for better error messages
- **Waiting**: Use proper waiting strategies for dynamic content
- **Screenshots**: Take screenshots for visual verification when needed

### Example Test Structure
```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Setup before each test
    await page.goto('/');
  });

  test('should perform specific action', async ({ page }) => {
    // Test implementation
    await page.click('[data-testid="button"]');
    await expect(page.locator('[data-testid="result"]')).toBeVisible();
  });
});
```

## Continuous Integration

### GitHub Actions
Tests are automatically run in CI/CD pipeline:
- **Pull Request Checks**: Tests run on every PR
- **Branch Protection**: Tests must pass before merging
- **Multiple Browsers**: Tests run across different browser engines
- **Parallel Execution**: Tests run in parallel for faster feedback

### Test Environment
- **Isolated Database**: Each test run uses a clean database state
- **Environment Variables**: CI-specific configuration
- **Artifacts**: Screenshots and videos saved on test failures
- **Notifications**: Test results reported to development team

## Debugging Tests

### Local Debugging
```bash
# Run tests with browser visible
npx playwright test --headed

# Run tests in debug mode with step-by-step execution
npx playwright test --debug

# Run specific test with debugging
npx playwright test auth.spec.ts --debug
```

### Test Artifacts
- **Screenshots**: Captured automatically on failures
- **Videos**: Recorded for failed tests (configurable)
- **Trace Files**: Detailed execution traces for debugging
- **Console Logs**: Browser console output captured

### Common Issues
1. **Timing Issues**: Use proper waiting strategies instead of fixed delays
2. **Element Selection**: Use stable selectors (data-testid preferred)
3. **Test Data**: Ensure test data is properly isolated and cleaned up
4. **Environment**: Verify test environment configuration matches expectations

## Test Coverage

### Areas Covered
- **Authentication Flows**: Complete user authentication lifecycle
- **User Interface**: Critical user interactions and workflows
- **API Integration**: Frontend-backend communication
- **Error Handling**: Error states and user feedback
- **Responsive Design**: Cross-device compatibility

### Future Test Areas
- **Admin Interface**: Administrative functionality testing
- **Question Management**: Question creation and editing workflows
- **Quiz Functionality**: Quiz taking and scoring
- **Image Management**: Image upload and display
- **Performance**: Load testing and performance validation

## Maintenance

### Regular Tasks
- **Update Dependencies**: Keep Playwright and test dependencies current
- **Review Test Results**: Monitor test stability and flakiness
- **Refactor Tests**: Improve test maintainability and readability
- **Add Coverage**: Expand test coverage for new features

### Test Data Management
- **Clean Up**: Regularly clean test databases and artifacts
- **Data Factories**: Maintain test data creation utilities
- **Environment Sync**: Keep test environments synchronized with production

---

For more information about testing in this project, see the main project documentation and Playwright's official documentation at https://playwright.dev/
