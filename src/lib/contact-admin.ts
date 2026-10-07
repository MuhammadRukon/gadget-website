/**
 * Lowercase "contact admin" clause for customer-facing copy, with the store's
 * contact number when one is configured. Pure; safe on client and server.
 */
export function adminClause(contactNumber: string | null): string {
  return contactNumber ? `contact admin at ${contactNumber}` : 'contact admin';
}
