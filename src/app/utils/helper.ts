export function removeOccur(str: string, char: string): string {
  if (!str) return '';
  return str.replace(new RegExp(char, 'g'), '');
}

export const uppercase = (text: string): string => {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
};
