/**
 * Version formatting utilities
 * Provides consistent version string formatting across the application
 */

/**
 * Formats version components into a semantic version string
 * @param major - Major version number (default: 1)
 * @param minor - Minor version number (default: 0)
 * @param patch - Patch version number (default: 0)
 * @param includeV - Whether to include 'v' prefix (default: true)
 * @returns Formatted version string (e.g., "v1.0.0" or "1.0.0")
 */
export function formatVersion(
  major: number | null | undefined,
  minor: number | null | undefined,
  patch: number | null | undefined,
  includeV: boolean = true
): string {
  const majorVersion = major ?? 1;
  const minorVersion = minor ?? 0;
  const patchVersion = patch ?? 0;

  const versionString = `${majorVersion}.${minorVersion}.${patchVersion}`;
  return includeV ? `v${versionString}` : versionString;
}

/**
 * Formats version from a question object
 * @param question - Question object with version components
 * @param includeV - Whether to include 'v' prefix (default: true)
 * @returns Formatted version string
 */
export function formatQuestionVersion(
  question: {
    version_major?: number | null;
    version_minor?: number | null;
    version_patch?: number | null;
  },
  includeV: boolean = true
): string {
  return formatVersion(
    question.version_major,
    question.version_minor,
    question.version_patch,
    includeV
  );
}
