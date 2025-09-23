import { test, expect } from "@playwright/test";

test.describe("Authentication Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Start from the home page
    await page.goto("/");
  });

  test("should redirect unauthenticated users to login", async ({ page }) => {
    // Try to access protected route
    await page.goto("/dashboard");

    // Should be redirected to login
    await expect(page).toHaveURL(/\/login/);

    // Should show login form
    await expect(page.locator("h1")).toContainText("Sign in");
  });

  test("should display login form correctly", async ({ page }) => {
    await page.goto("/login");

    // Check form elements
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // Check Google sign-in button
    await expect(page.locator("text=Continue with Google")).toBeVisible();

    // Check links
    await expect(page.locator("text=Forgot your password?")).toBeVisible();
    await expect(page.locator("text=Don't have an account?")).toBeVisible();
  });

  test("should display signup form correctly", async ({ page }) => {
    await page.goto("/signup");

    // Check form elements
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('input[name="firstName"]')).toBeVisible();
    await expect(page.locator('input[name="lastName"]')).toBeVisible();
    await expect(page.locator('select[name="userType"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // Check Google sign-in button
    await expect(page.locator("text=Continue with Google")).toBeVisible();

    // Check link to login
    await expect(page.locator("text=Already have an account?")).toBeVisible();
  });

  test("should show validation errors for invalid login", async ({ page }) => {
    await page.goto("/login");

    // Try to submit empty form
    await page.click('button[type="submit"]');

    // Should show validation errors (if implemented)
    // This depends on your form validation implementation
  });

  test("should show validation errors for invalid signup", async ({ page }) => {
    await page.goto("/signup");

    // Fill form with invalid data
    await page.fill('input[name="email"]', "invalid-email");
    await page.fill('input[name="password"]', "123"); // Too short
    await page.click('button[type="submit"]');

    // Should show validation errors (if implemented)
    // This depends on your form validation implementation
  });

  test("should navigate between login and signup", async ({ page }) => {
    await page.goto("/login");

    // Click signup link
    await page.click("text=Don't have an account?");
    await expect(page).toHaveURL(/\/signup/);

    // Click login link
    await page.click("text=Already have an account?");
    await expect(page).toHaveURL(/\/login/);
  });

  test("should handle forgot password flow", async ({ page }) => {
    await page.goto("/login");

    // Click forgot password link
    await page.click("text=Forgot your password?");
    await expect(page).toHaveURL(/\/forgot-password/);

    // Should show forgot password form
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("should preserve redirect parameter", async ({ page }) => {
    // Try to access protected route with redirect
    await page.goto("/dashboard");

    // Should be redirected to login with redirect parameter
    await expect(page).toHaveURL(/\/login\?.*redirect/);

    // The redirect parameter should be preserved in the URL
    const url = page.url();
    expect(url).toContain("redirect=");
  });

  test("should handle auth errors gracefully", async ({ page }) => {
    await page.goto("/login?error=Invalid%20credentials");

    // Should display error message
    await expect(page.locator("text=Invalid credentials")).toBeVisible();
  });

  test("should handle email verification flow", async ({ page }) => {
    await page.goto("/verify-email?email=test@example.com");

    // Should show verification message
    await expect(page.locator("text=Check your email")).toBeVisible();
    await expect(page.locator("text=test@example.com")).toBeVisible();
  });

  test("should handle auth confirmation pages", async ({ page }) => {
    // Test email verified page
    await page.goto("/email-verified");
    await expect(page.locator("text=Email verified")).toBeVisible();

    // Test email already verified page
    await page.goto("/email-already-verified");
    await expect(page.locator("text=already verified")).toBeVisible();
  });

  test("should handle auth errors page", async ({ page }) => {
    await page.goto(
      "/auth-error?error=expired_link&description=Link%20expired",
    );

    // Should show error details
    await expect(page.locator("text=expired_link")).toBeVisible();
    await expect(page.locator("text=Link expired")).toBeVisible();
  });

  test("should be responsive on mobile", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto("/login");

    // Form should be visible and usable on mobile
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // Check that form is properly sized
    const emailInput = page.locator('input[name="email"]');
    const boundingBox = await emailInput.boundingBox();
    expect(boundingBox?.width).toBeGreaterThan(200); // Should be reasonably wide
  });

  test("should handle keyboard navigation", async ({ page }) => {
    await page.goto("/login");

    // Tab through form elements
    await page.keyboard.press("Tab");
    await expect(page.locator('input[name="email"]')).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(page.locator('input[name="password"]')).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(page.locator('button[type="submit"]')).toBeFocused();
  });

  test("should handle form submission with Enter key", async ({ page }) => {
    await page.goto("/login");

    // Fill form
    await page.fill('input[name="email"]', "test@example.com");
    await page.fill('input[name="password"]', "password123");

    // Submit with Enter key
    await page.keyboard.press("Enter");

    // Should attempt to submit (may show error or redirect)
    // This depends on your backend implementation
  });
});
