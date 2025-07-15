# Auth Security Configuration

## Leaked Password Protection

**Status**: ❌ NOT AVAILABLE ON CURRENT PLAN

**Issue**: Supabase Security Advisor reports that leaked password protection is currently disabled.

**Description**: Leaked password protection prevents users from using compromised passwords by checking against HaveIBeenPwned.org database.

### Plan Limitation

This feature is only available on Supabase Pro Plans and cannot be enabled on the current plan:

**Current Plan**: Free/Starter Plan
**Required Plan**: Pro Plan ($25/month)

**Alternative Security Measures**:
Since leaked password protection is not available, consider implementing:
   - **Password Strength**: Ensure minimum requirements are set
   - **Rate Limiting**: Configure appropriate limits for auth endpoints
   - **Session Management**: Review session timeout settings
   - **Email Verification**: Ensure email verification is required

### Benefits

- **Enhanced Security**: Prevents users from using known compromised passwords
- **Compliance**: Helps meet security best practices
- **User Protection**: Protects users from credential stuffing attacks

### Implementation Notes

- This feature works by hashing the password and checking the first 5 characters of the hash against the HaveIBeenPwned API
- No actual passwords are sent to external services
- The check happens during password creation and updates
- Users will be prompted to choose a different password if their chosen password is found in the breach database

### Verification

After enabling, you can verify the setting is active by:
1. Attempting to create an account with a known compromised password (e.g., "password123")
2. The system should reject the password and prompt for a different one

### Related Documentation

- [Supabase Auth Password Security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
- [HaveIBeenPwned API](https://haveibeenpwned.com/API/v3)

---

**Action Required**: Manual configuration in Supabase Dashboard to enable leaked password protection.
