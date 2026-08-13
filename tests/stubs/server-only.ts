/**
 * No-op stand-in for the `server-only` package under Vitest.
 *
 * `server-only` deliberately throws when a bundler resolves it through the
 * client condition, which is exactly the guard we want in the app — but Vitest
 * runs in a happy-dom (client-ish) environment, so importing any server-only
 * module from a test would fail on the import alone rather than on anything the
 * test asserts.
 *
 * Aliased in vitest.config.ts. This does NOT weaken the production guarantee:
 * the real package is still what Next resolves during a build, so a client
 * component importing ai-keys.ts remains a build error.
 */
export {};
