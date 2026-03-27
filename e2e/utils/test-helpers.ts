/**
 * Generates a unique test identifier by appending the current timestamp and a
 * random number to the provided base string.  Use this wherever tests need a
 * unique name/title to avoid collisions between runs.
 *
 * @param base - A human-readable prefix that describes what is being created.
 * @returns A unique string of the form `{base}-{timestamp}{random}`.
 */
export function uniqueTestID(base: string): string {
  return `${base}-${Date.now()}${Math.floor(Math.random() * 1000)}`;
}
