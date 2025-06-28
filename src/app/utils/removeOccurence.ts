export function removeOccurrence(str: string, char: string): string {
  if (!str) return '';
  return str.replace(char, '');
}
