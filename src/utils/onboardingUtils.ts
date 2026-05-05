/**
 * Onboarding utilities for the guided first-time wizard.
 */

/**
 * Returns a suggested family name based on the user's last name.
 *
 * Examples:
 *   "Smith"  → "The Smiths"
 *   "Jones"  → "The Joneses"
 *   "Brady"  → "The Bradys"
 *   ""       → ""
 *   null     → ""
 */
export function getDefaultFamilyName(lastName: string | null | undefined): string {
  if (!lastName || !lastName.trim()) return '';
  const trimmed = lastName.trim();
  const lower = trimmed.toLowerCase();
  let plural: string;
  if (lower.endsWith('s') || lower.endsWith('x') || lower.endsWith('z') ||
      lower.endsWith('ch') || lower.endsWith('sh')) {
    plural = trimmed + 'es';
  } else {
    plural = trimmed + 's';
  }
  return `The ${plural}`;
}
