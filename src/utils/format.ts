const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];

// "2017-03-03" -> "3 mar 2017"
export function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
  if (!y) return null;
  if (!m || !d) return String(y);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
