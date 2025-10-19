// src/tests/run-tests.ts
/**
 * Test runner for user management tests
 * Runs all tests and generates a comprehensive report
 */

import { testUserCreationFlow } from './user-creation.test'
import { testUserDeletionFlow } from './user-deletion.test'
import { getDatabaseState } from './user-management.test'

async function runAllTests() {
  console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║                   USER MANAGEMENT END-TO-END TESTS                         ║
║                                                                            ║
║  Testing user creation and deletion functionality migrated from database  ║
║  triggers to application code.                                            ║
╚════════════════════════════════════════════════════════════════════════════╝
  `)

  const startTime = Date.now()

  try {
    // Run creation tests
    await testUserCreationFlow()

    // Run deletion tests
    await testUserDeletionFlow()

    // Final verification
    console.log(`\n${'='.repeat(70)}`)
    console.log(`📋 FINAL DATABASE STATE`)
    console.log(`${'='.repeat(70)}`)

    const finalState = await getDatabaseState()
    console.log(`
  ✅ auth.users: ${finalState.authUsersCount}
  ✅ public.users: ${finalState.publicUsersCount}
  ✅ user_settings: ${finalState.userSettingsCount}
  ✅ Soft deleted users: ${finalState.softDeletedCount}
  ✅ Orphaned auth users: ${finalState.orphanedAuthUsers.length}
  ✅ Orphaned public users: ${finalState.orphanedPublicUsers.length}
    `)

    const duration = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log(`\n✨ All tests completed in ${duration}s`)

  } catch (error) {
    console.error(`\n❌ Test suite failed:`, error)
    process.exit(1)
  }
}

// Run tests
runAllTests().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})

