export function removeOccur(str: string, char: string): string {
  if (!str) return '';
  return str.replace(new RegExp(char, 'g'), '');
}
