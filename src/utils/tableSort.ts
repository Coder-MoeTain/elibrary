export function compareValues(
  a: unknown,
  b: unknown,
  order: "asc" | "desc",
): number {
  if (a == null && b == null) return 0;
  if (a == null) return order === "asc" ? 1 : -1;
  if (b == null) return order === "asc" ? -1 : 1;
  if (typeof a === "number" && typeof b === "number") {
    if (a < b) return order === "asc" ? -1 : 1;
    if (a > b) return order === "asc" ? 1 : -1;
    return 0;
  }
  const as = String(a).toLowerCase();
  const bs = String(b).toLowerCase();
  if (as < bs) return order === "asc" ? -1 : 1;
  if (as > bs) return order === "asc" ? 1 : -1;
  return 0;
}

export function sortRows<T extends Record<string, unknown>>(
  rows: T[],
  sortKey: string | null,
  sortOrder: "asc" | "desc",
): T[] {
  if (!sortKey) return rows;
  const key = sortKey as keyof T;
  return [...rows].sort((a, b) => compareValues(a[key], b[key], sortOrder));
}
