/** Session keys so detail "Back" restores the admin list page/filters. */
export const ADMIN_BOOKS_LIST_RETURN_KEY = "adminBooksListReturnTo";
export const ADMIN_EBOOKS_LIST_RETURN_KEY = "adminEbooksListReturnTo";
export const ADMIN_IMPORTS_LIST_RETURN_KEY = "adminImportsListReturnTo";
/** Last admin catalog list (ebooks or imports) opened before a detail view. */
export const ADMIN_CATALOG_LIST_RETURN_KEY = "adminCatalogListReturnTo";

export function parsePositiveInt(raw: string | null | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.trunc(n) : fallback;
}

export function buildQueryString(params: Record<string, string | number | undefined | null>): string {
  const next = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value == null) return;
    const text = String(value).trim();
    if (!text) return;
    next.set(key, text);
  });
  const s = next.toString();
  return s ? `?${s}` : "";
}
