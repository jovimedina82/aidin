/**
 * Server-only guard utility
 * Throws an error if a server-only module is imported into a client bundle
 */
export function assertServerOnly(modName: string): void {
  if (typeof window !== 'undefined') {
    throw new Error(
      `${modName} was imported into a client bundle. This module is server-only.`
    );
  }
}
