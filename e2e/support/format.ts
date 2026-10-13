// Mirrors `formatBDT` (src/server/common/money.ts): tests compare against this, never hard-coded strings.
const formatter = new Intl.NumberFormat('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export const formatBDT = (cents: number) => `Tk ${formatter.format(cents / 100)}`;
