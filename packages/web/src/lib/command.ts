/**
 * Subsequence match for the command palette: "nel" matches "NorthsideElementary".
 * Pure and dependency-free so it can be tested without pulling in React.
 */
export function fuzzyMatch(text: string, query: string): boolean {
  const t = text.toLowerCase();
  const q = query.trim().toLowerCase();
  if (!q) return true;
  let i = 0;
  for (const ch of q) {
    if (ch === " ") continue;
    i = t.indexOf(ch, i);
    if (i === -1) return false;
    i++;
  }
  return true;
}
