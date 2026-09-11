import axios from "axios";
import { getLoginPathForRole, isAuthPage } from "../config/authPaths";
import { getRole } from "../utils/auth";

/**
 * Express mounts routes at `/api`. If `VITE_API_URL` is only an origin (e.g. `http://localhost:3000`),
 * requests would hit `/dashboard/...` on the root and return 404 "Route not found".
 * In dev, default to same-origin `/api` and forward via Vite proxy (see vite.config.ts).
 */
function resolveApiBaseURL(): string {
  const envVal = import.meta.env.VITE_API_URL;
  if (typeof envVal === "string" && envVal.trim()) {
    const t = envVal.trim().replace(/\/+$/, "");
    if (t.startsWith("/")) {
      return t === "/api" || t.startsWith("/api/") ? t.replace(/\/+$/, "") || "/api" : t;
    }
    try {
      const u = new URL(t);
      const path = u.pathname.replace(/\/+$/, "");
      if (!path || path === "/") {
        return `${u.origin}/api`;
      }
      return t;
    } catch {
      /* invalid URL string */
    }
  }
  // Dev: Vite proxy → /api. Prod: same Express host → /api.
  return "/api";
}

const baseURL = resolveApiBaseURL();

/**
 * 401 responses that indicate validation or login failure, not an invalid/expired session.
 * Do not clear JWT or redirect — the user should stay on the page and see the error.
 */
const SKIP_SESSION_CLEAR_ON_401_MESSAGES = new Set([
  "Invalid credentials",
  "Your account is not approved yet",
  "Your account has been rejected",
  "Current password is wrong",
  "Current password is incorrect"
]);

export const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
  timeout: 15000
});

/** Short-lived requests for summary polling / cached reads on slow cloud hosts. */
const summaryApi = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
  timeout: 60000
});

function attachApiInterceptors(instance: typeof api) {
  instance.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    const isAuthRoute = typeof config.url === "string" && config.url.includes("/auth/");
    if (token && !isAuthRoute) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  instance.interceptors.response.use(
    (res) => res,
    (err) => {
      if (err.response?.status === 401) {
        const data = err.response?.data as { message?: string } | undefined;
        const message = typeof data?.message === "string" ? data.message.trim() : "";
        const skipSessionClear = SKIP_SESSION_CLEAR_ON_401_MESSAGES.has(message);

        if (!skipSessionClear) {
          localStorage.removeItem("token");
          const url = typeof err.config?.url === "string" ? err.config.url : "";
          const isAuthRoute = url.includes("/auth/");
          const currentPath = typeof window !== "undefined" ? window.location.pathname : "";
          const onAuthPage = isAuthPage(currentPath);
          if (typeof window !== "undefined" && !isAuthRoute && !onAuthPage) {
            window.location.href = getLoginPathForRole(getRole());
          }
        }
      }
      return Promise.reject(err);
    }
  );
}

attachApiInterceptors(api);
attachApiInterceptors(summaryApi);

export type RegisterPayload = {
  user_name: string;
  email: string;
  password: string;
  date_of_birth: string;
  department_id: number;
};

/** Matches DB/API: primary key `department_id`, display `department_name`. */
export type DepartmentOption = {
  department_id: number;
  department_name: string;
};

type ApiEnvelope<T = unknown> = {
  success?: boolean;
  message?: string;
  data?: T;
  errors?: { msg?: string; path?: string }[];
  dependencyCount?: number;
  activeRentalCount?: number;
  meta?: {
    restored?: boolean;
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    hasMore?: boolean;
  };
};

export function isAxiosConflict(err: unknown): boolean {
  return axios.isAxiosError(err) && err.response?.status === 409;
}

export function getApiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as ApiEnvelope | undefined;
    if (data?.errors?.length) {
      return data.errors
        .map((e) => e.msg ?? (e as unknown as { message?: string }).message ?? "")
        .filter(Boolean)
        .join(". ") || "Validation failed";
    }
    if (err.response?.status === 409) {
      const msg = data?.message;
      if (typeof msg === "string" && msg.trim()) return msg;
      return "This action cannot be completed.";
    }
    if (err.response?.status === 422) {
      const msg = data?.message;
      if (typeof msg === "string" && msg.trim()) {
        if (msg.toLowerCase().includes("exists")) {
          return "A department with this name already exists.";
        }
        return msg;
      }
      return "Invalid department data.";
    }
    if (data?.message && typeof data.message === "string") {
      if (data.message.toLowerCase().includes("exists")) {
        return "A department with this name already exists.";
      }
      return data.message;
    }
    return err.message || "Request failed";
  }
  if (err instanceof Error && err.message.trim()) {
    return err.message;
  }
  return "Something went wrong";
}

export async function registerUser(payload: RegisterPayload): Promise<ApiEnvelope> {
  const { data } = await api.post<ApiEnvelope>("/auth/register", payload);
  return data;
}

export type LoginTokenData = {
  token: string;
  admin?: unknown;
  user?: unknown;
};

export async function loginAdmin(adminName: string, password: string): Promise<ApiEnvelope<LoginTokenData>> {
  const { data } = await api.post<ApiEnvelope<LoginTokenData>>("/auth/admin/login", {
    adminName,
    password
  });
  return data;
}

export async function loginUser(userName: string, password: string): Promise<ApiEnvelope<LoginTokenData>> {
  const { data } = await api.post<ApiEnvelope<LoginTokenData>>("/auth/user/login", {
    userName,
    password
  });
  return data;
}

export type DashboardStats = {
  totalBooks: number;
  totalEbooks: number;
  totalUsers: number;
  monthlyRentals: number;
  importedPapers: number;
};

function normalizeDashboardStats(raw: unknown): DashboardStats {
  const r = raw as Record<string, unknown>;
  return {
    totalBooks: Math.max(0, Math.trunc(Number(r.totalBooks ?? 0))),
    totalEbooks: Math.max(0, Math.trunc(Number(r.totalEbooks ?? 0))),
    totalUsers: Math.max(0, Math.trunc(Number(r.totalUsers ?? 0))),
    monthlyRentals: Math.max(0, Math.trunc(Number(r.monthlyRentals ?? 0))),
    importedPapers: Math.max(0, Math.trunc(Number(r.importedPapers ?? 0)))
  };
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const empty: DashboardStats = {
    totalBooks: 0,
    totalEbooks: 0,
    totalUsers: 0,
    monthlyRentals: 0,
    importedPapers: 0
  };

  const fromSummary = async (): Promise<DashboardStats | null> => {
    const { data } = await api.get<ApiEnvelope<unknown>>("/dashboard/summary");
    const d = data.data as Record<string, unknown> | undefined;
    if (!d) return null;
    const stats = d.stats as Record<string, unknown> | undefined;
    const rentals = (d.charts as Record<string, unknown> | undefined)?.rentals as
      | Record<string, unknown>
      | undefined;
    if (!stats || typeof stats !== "object") return null;
    return {
      totalBooks: Math.max(0, Math.trunc(Number(stats.totalBooks ?? 0))),
      totalEbooks: Math.max(0, Math.trunc(Number(stats.totalEbooks ?? 0))),
      totalUsers: Math.max(0, Math.trunc(Number(stats.totalUsers ?? 0))),
      monthlyRentals: Math.max(0, Math.trunc(Number(rentals?.monthlyRentCount ?? 0))),
      importedPapers: Math.max(0, Math.trunc(Number(stats.importedPapers ?? 0)))
    };
  };

  try {
    const { data } = await api.get<ApiEnvelope<unknown>>("/dashboard/stats");
    const inner = data.data;
    if (inner && typeof inner === "object") return normalizeDashboardStats(inner);
    return empty;
  } catch (e) {
    if (!axios.isAxiosError(e) || e.response?.status !== 404) throw e;
    try {
      const mapped = await fromSummary();
      if (mapped) return mapped;
    } catch (summaryErr) {
      throw summaryErr;
    }
    throw e;
  }
}

export type MonthlySeriesPoint = { month: string; total: number };

export type CategoryDistributionItem = { name: string; value: number };

export type PopularBookItem = { book_name: string; rent_count: number };

export type OverdueRentalItem = { user_name: string; book_name: string; due_date: string };

function parseEnvelopeArray<T>(payload: ApiEnvelope<unknown>): T[] {
  const rows = payload.data;
  return Array.isArray(rows) ? (rows as T[]) : [];
}

export async function getDashboardRentalsMonthly(): Promise<MonthlySeriesPoint[]> {
  const { data } = await api.get<ApiEnvelope<unknown>>("/dashboard/rentals/monthly");
  return parseEnvelopeArray<MonthlySeriesPoint>(data);
}

export async function getDashboardBooksCategories(): Promise<CategoryDistributionItem[]> {
  const { data } = await api.get<ApiEnvelope<unknown>>("/dashboard/books/categories");
  return parseEnvelopeArray<CategoryDistributionItem>(data);
}

export async function getDashboardEbooksCategories(): Promise<CategoryDistributionItem[]> {
  const { data } = await api.get<ApiEnvelope<unknown>>("/dashboard/ebooks/categories");
  return parseEnvelopeArray<CategoryDistributionItem>(data);
}

export async function getDashboardBooksPopular(): Promise<PopularBookItem[]> {
  const { data } = await api.get<ApiEnvelope<unknown>>("/dashboard/books/popular");
  return parseEnvelopeArray<PopularBookItem>(data);
}

export async function getDashboardRentalsOverdue(): Promise<OverdueRentalItem[]> {
  const { data } = await api.get<ApiEnvelope<unknown>>("/dashboard/rentals/overdue");
  return parseEnvelopeArray<OverdueRentalItem>(data);
}

export async function getDashboardUsersGrowth(): Promise<MonthlySeriesPoint[]> {
  const { data } = await api.get<ApiEnvelope<unknown>>("/dashboard/users/growth");
  return parseEnvelopeArray<MonthlySeriesPoint>(data);
}

export type PopularEbookItem = { ebook_name: string; read_count: number };

export type DashboardAnalyticsBundle = {
  monthlyRentals: MonthlySeriesPoint[];
  categories: CategoryDistributionItem[];
  ebooksCategories: CategoryDistributionItem[];
  popularBooks: PopularBookItem[];
  popularEbooks: PopularEbookItem[];
  overdue: OverdueRentalItem[];
  userGrowth: MonthlySeriesPoint[];
};

function parseAnalyticsBundle(analytics: unknown): DashboardAnalyticsBundle {
  const a = (analytics && typeof analytics === "object" ? analytics : {}) as Record<string, unknown>;

  const mapSeries = (xs: unknown): MonthlySeriesPoint[] =>
    Array.isArray(xs)
      ? xs.map((x) => {
          const r = x as Record<string, unknown>;
          return {
            month: String(r.month ?? ""),
            total: Math.max(0, Math.trunc(Number(r.total ?? 0)))
          };
        })
      : [];

  const mapCategories = (xs: unknown): CategoryDistributionItem[] =>
    Array.isArray(xs)
      ? xs.map((x) => {
          const r = x as Record<string, unknown>;
          return {
            name: String(r.name ?? ""),
            value: Math.max(0, Math.trunc(Number(r.value ?? 0)))
          };
        })
      : [];

  const mapPopularBooks = (xs: unknown): PopularBookItem[] =>
    Array.isArray(xs)
      ? xs.map((x) => {
          const r = x as Record<string, unknown>;
          return {
            book_name: String(r.book_name ?? r.bookName ?? ""),
            rent_count: Math.max(0, Math.trunc(Number(r.rent_count ?? r.rentCount ?? 0)))
          };
        })
      : [];

  const mapPopularEbooks = (xs: unknown): PopularEbookItem[] =>
    Array.isArray(xs)
      ? xs.map((x) => {
          const r = x as Record<string, unknown>;
          return {
            ebook_name: String(r.ebook_name ?? r.ebookName ?? ""),
            read_count: Math.max(0, Math.trunc(Number(r.read_count ?? r.readCount ?? 0)))
          };
        })
      : [];

  const mapOverdue = (xs: unknown): OverdueRentalItem[] =>
    Array.isArray(xs)
      ? xs.map((x) => {
          const r = x as Record<string, unknown>;
          return {
            user_name: String(r.user_name ?? r.userName ?? ""),
            book_name: String(r.book_name ?? r.bookName ?? ""),
            due_date: String(r.due_date ?? r.dueDate ?? "")
          };
        })
      : [];

  return {
    monthlyRentals: mapSeries(a.monthlyRentals ?? a.monthly_rentals),
    categories: mapCategories(a.categories ?? a.books_by_category),
    ebooksCategories: mapCategories(a.ebooksCategories ?? a.ebooks_categories),
    popularBooks: mapPopularBooks(a.popularBooks ?? a.popular_books),
    popularEbooks: mapPopularEbooks(a.popularEbooks ?? a.popular_ebooks),
    overdue: mapOverdue(a.overdue ?? a.overdue_rentals),
    userGrowth: mapSeries(a.userGrowth ?? a.user_growth)
  };
}

export async function getDashboardEbooksPopular(): Promise<PopularEbookItem[]> {
  const { data } = await api.get<ApiEnvelope<unknown>>("/dashboard/ebooks/popular");
  return parseEnvelopeArray<PopularEbookItem>(data);
}

/** Prefers `analytics` on GET /dashboard/summary (one round-trip); falls back to granular endpoints. */
export async function getDashboardAnalytics(): Promise<DashboardAnalyticsBundle> {
  const fromGranular = async (): Promise<DashboardAnalyticsBundle> => {
    const [monthlyRentals, categories, ebooksCategories, popularBooks, overdue, userGrowth, popularEbooks] = await Promise.all([
      getDashboardRentalsMonthly().catch(() => [] as MonthlySeriesPoint[]),
      getDashboardBooksCategories().catch(() => [] as CategoryDistributionItem[]),
      getDashboardEbooksCategories().catch(() => [] as CategoryDistributionItem[]),
      getDashboardBooksPopular().catch(() => [] as PopularBookItem[]),
      getDashboardRentalsOverdue().catch(() => [] as OverdueRentalItem[]),
      getDashboardUsersGrowth().catch(() => [] as MonthlySeriesPoint[]),
      getDashboardEbooksPopular().catch(() => [] as PopularEbookItem[])
    ]);

    return {
      monthlyRentals,
      categories,
      ebooksCategories,
      popularBooks,
      popularEbooks,
      overdue,
      userGrowth
    };
  };

  const hasAnyData = (b: DashboardAnalyticsBundle): boolean =>
    b.monthlyRentals.length > 0 ||
    b.categories.length > 0 ||
    b.ebooksCategories.length > 0 ||
    b.popularBooks.length > 0 ||
    b.popularEbooks.length > 0 ||
    b.overdue.length > 0 ||
    b.userGrowth.length > 0;

  try {
    const { data } = await api.get<ApiEnvelope<unknown>>("/dashboard/summary");
    const d = data.data as Record<string, unknown> | undefined;
    if (d?.analytics != null && typeof d.analytics === "object") {
      const bundle = parseAnalyticsBundle(d.analytics);
      // Some older/stale API instances can return an empty analytics object.
      // In that case, fall back to granular routes to avoid false "empty" dashboards.
      if (hasAnyData(bundle)) return bundle;
      const granular = await fromGranular();
      return hasAnyData(granular) ? granular : bundle;
    }
  } catch (e) {
    if (!axios.isAxiosError(e)) throw e;
    const st = e.response?.status;
    if (st && st !== 404) throw e;
  }

  return fromGranular();
}

function normalizeDepartmentRow(raw: unknown): DepartmentOption | null {
  const r = raw as Record<string, unknown>;
  const id = Number(r.departmentId ?? r.department_id);
  const name = String(r.departmentName ?? r.department_name ?? "");
  if (!Number.isFinite(id) || id < 1 || !name.trim()) return null;
  return { department_id: Math.trunc(id), department_name: name };
}

function parseDepartmentList(payload: ApiEnvelope<unknown[]>): DepartmentOption[] {
  const rows = payload.data;
  if (!Array.isArray(rows)) return [];
  return rows.map(normalizeDepartmentRow).filter((x): x is DepartmentOption => x !== null);
}

/**
 * Loads departments for registration.
 * Tries GET /departments (Bearer if token exists), then GET /departments/public (no auth required).
 */
export async function fetchDepartmentsForRegister(): Promise<DepartmentOption[]> {
  try {
    const { data } = await api.get<ApiEnvelope<unknown[]>>("/departments");
    const list = parseDepartmentList(data);
    if (list.length > 0) return list;
  } catch {
    /* unauthenticated or empty — try public */
  }

  try {
    const { data } = await api.get<ApiEnvelope<unknown[]>>("/departments/public");
    return parseDepartmentList(data);
  } catch {
    return [];
  }
}

export type BookPayload = {
  book_name: string;
  author_id?: number;
  author_name?: string;
  category_id?: number;
  category_name?: string;
  release_date: string;
  description: string;
  cover_file?: File | null;
  cover_image?: string;
  place?: string;
};

export type BookItem = {
  book_id: number;
  book_name: string;
  author_id: number;
  category_id: number;
  release_date: string | null;
  description: string;
  cover_image: string;
  place: string;
  author_name: string;
  category_name: string;
  available: boolean;
};

export type AuthorOption = { author_id: number; author_name: string; country: string };
export type CategoryOption = { category_id: number; category_name: string };

function normalizeBook(raw: unknown): BookItem | null {
  const r = raw as Record<string, unknown>;
  const id = Number(r.bookId ?? r.book_id);
  const authorId = Number(r.Author_Author_id ?? r.authorId ?? r.author_id);
  const categoryId = Number(r.Category_category_id ?? r.categoryId ?? r.category_id);
  const bookName = String(r.bookName ?? r.book_name ?? "");
  if (!id || !bookName) return null;

  const authorObj = (r.author ?? {}) as Record<string, unknown>;
  const categoryObj = (r.category ?? {}) as Record<string, unknown>;
  const availableRaw = r.available;
  return {
    book_id: id,
    book_name: bookName,
    author_id: authorId,
    category_id: categoryId,
    release_date: (r.releaseDate as string | null) ?? (r.release_date as string | null) ?? null,
    description: String(r.description ?? ""),
    cover_image: String(r.coverImage ?? r.cover_image ?? ""),
    place: String(r.place ?? ""),
    author_name: String(authorObj.authorName ?? authorObj.author_name ?? ""),
    category_name: String(categoryObj.categoryName ?? categoryObj.category_name ?? ""),
    available: typeof availableRaw === "boolean" ? availableRaw : true
  };
}

function normalizeAuthor(raw: unknown): AuthorOption | null {
  const r = raw as Record<string, unknown>;
  const id = Number(r.authorId ?? r.author_id);
  const name = String(r.authorName ?? r.author_name ?? "");
  if (!id || !name) return null;
  return { author_id: id, author_name: name, country: String(r.country ?? "") };
}

function normalizeCategory(raw: unknown): CategoryOption | null {
  const r = raw as Record<string, unknown>;
  const id = Number(r.categoryId ?? r.category_id);
  const name = String(r.categoryName ?? r.category_name ?? "");
  if (!id || !name) return null;
  return { category_id: id, category_name: name };
}

export async function getBooks(): Promise<BookItem[]> {
  const { data } = await api.get<ApiEnvelope<unknown[]>>("/books");
  const rows = Array.isArray(data.data) ? data.data : [];
  return rows.map(normalizeBook).filter((x): x is BookItem => x !== null);
}

export async function getBooksPage(options?: {
  page?: number;
  limit?: number;
  q?: string;
  category?: string;
  available?: boolean | "true" | "false";
  sortBy?: string;
  sortDir?: "asc" | "desc";
}): Promise<{ items: BookItem[]; page: number; limit: number; total: number; totalPages: number; hasMore: boolean }> {
  const params: Record<string, string | number | boolean> = { paged: "true" };
  if (options?.page) params.page = options.page;
  if (options?.limit) params.limit = options.limit;
  if (options?.q) params.q = options.q;
  if (options?.category) params.category = options.category;
  if (options?.available !== undefined) params.available = options.available;
  if (options?.sortBy) params.sortBy = options.sortBy;
  if (options?.sortDir) params.sortDir = options.sortDir;

  const { data } = await api.get<ApiEnvelope<unknown[]>>("/books", { params });
  const rows = Array.isArray(data.data) ? data.data : [];
  const items = rows.map(normalizeBook).filter((x): x is BookItem => x !== null);
  const page = Math.max(1, Number(data.meta?.page ?? options?.page ?? 1));
  const limit = Math.max(1, Number(data.meta?.limit ?? options?.limit ?? 40));
  const total = Math.max(0, Number(data.meta?.total ?? items.length));
  const rawTotalPages = data.meta?.totalPages ?? Math.ceil(total / limit);
  const totalPages = Math.max(1, Number(rawTotalPages) || 1);
  const hasMore =
    typeof (data.meta as { hasMore?: boolean } | undefined)?.hasMore === "boolean"
      ? Boolean((data.meta as { hasMore?: boolean }).hasMore)
      : page < totalPages;
  return { items, page, limit, total, totalPages, hasMore };
}

export async function getBookById(bookId: number): Promise<BookItem> {
  const { data } = await api.get<ApiEnvelope<unknown>>(`/books/${bookId}`);
  const row = normalizeBook(data.data ?? {});
  if (!row) throw new Error("Book not found");
  return row;
}

export async function getBookAvailability(bookId: number): Promise<{ available: boolean }> {
  const { data } = await api.get<ApiEnvelope<{ available?: boolean }>>(`/books/${bookId}/availability`);
  return { available: Boolean(data.data?.available) };
}

export async function createBook(payload: BookPayload): Promise<void> {
  const form = new FormData();
  form.append("bookName", payload.book_name);
  if (payload.author_id) {
    const id = String(payload.author_id);
    form.append("authorId", id);
    form.append("author_id", id);
  }
  if (payload.author_name) {
    form.append("authorName", payload.author_name);
    form.append("author_name", payload.author_name);
  }
  if (payload.category_id) {
    const id = String(payload.category_id);
    form.append("categoryId", id);
    form.append("category_id", id);
  }
  if (payload.category_name) {
    form.append("categoryName", payload.category_name);
    form.append("category_name", payload.category_name);
  }
  if (payload.release_date) form.append("releaseDate", payload.release_date);
  if (payload.description) form.append("description", payload.description);
  if (payload.place) form.append("place", payload.place);
  if (payload.cover_file) form.append("cover", payload.cover_file);
  await api.post("/books", form, { headers: { "Content-Type": "multipart/form-data" } });
}

export async function updateBook(id: number, payload: BookPayload): Promise<void> {
  const form = new FormData();
  form.append("bookName", payload.book_name);
  if (payload.author_id) {
    const authorId = String(payload.author_id);
    form.append("authorId", authorId);
    form.append("author_id", authorId);
  }
  if (payload.category_id) {
    const categoryId = String(payload.category_id);
    form.append("categoryId", categoryId);
    form.append("category_id", categoryId);
  }
  if (payload.author_name) {
    form.append("authorName", payload.author_name);
    form.append("author_name", payload.author_name);
  }
  if (payload.category_name) {
    form.append("categoryName", payload.category_name);
    form.append("category_name", payload.category_name);
  }
  if (payload.release_date) form.append("releaseDate", payload.release_date);
  if (payload.description) form.append("description", payload.description);
  if (payload.place) form.append("place", payload.place);
  if (payload.cover_file) form.append("cover", payload.cover_file);
  await api.put(`/books/${id}`, form, { headers: { "Content-Type": "multipart/form-data" } });
}

export async function deleteBook(id: number): Promise<void> {
  await api.delete(`/books/${id}`);
}

export async function getAuthors(): Promise<AuthorOption[]> {
  const { data } = await api.get<ApiEnvelope<unknown[]>>("/authors");
  const rows = Array.isArray(data.data) ? data.data : [];
  return rows.map(normalizeAuthor).filter((x): x is AuthorOption => x !== null);
}

export async function getCategories(): Promise<CategoryOption[]> {
  const { data } = await api.get<ApiEnvelope<unknown[]>>("/categories");
  const rows = Array.isArray(data.data) ? data.data : [];
  return rows.map(normalizeCategory).filter((x): x is CategoryOption => x !== null);
}

/* ——— eBooks ——— */

export type EbookPayload = {
  ebook_name: string;
  author_id?: number;
  author_name?: string;
  category_id?: number;
  category_name?: string;
  release_date: string;
  description: string;
  cover_file?: File | null;
  pdf_file?: File | null;
  cover_image?: string;
  pdf_url?: string;
};

export type EbookSummaryStatus = "pending" | "processing" | "completed" | "failed";

export type EbookItem = {
  ebook_id: number;
  ebook_name: string;
  author_id: number;
  category_id: number;
  release_date: string | null;
  description: string;
  cover_image: string;
  pdf_file: string;
  pdf_available: boolean;
  author_name: string;
  category_name: string;
  read_count: number;
  summary_status: EbookSummaryStatus;
  created_at: string;
};

function normalizeEbookSummaryStatus(raw: unknown): EbookSummaryStatus {
  const s = String(raw ?? "pending").trim().toLowerCase();
  if (s === "completed" || s === "processing" || s === "failed") return s;
  return "pending";
}

export type FavoriteItem = {
  favorite_id: number;
  ebook: EbookItem;
};

function normalizeEbook(raw: unknown): EbookItem | null {
  const r = raw as Record<string, unknown>;
  const id = Number(r.eBooksId ?? r.eBooks_id ?? r.ebook_id);
  const authorId = Number(r.Author_Author_id ?? r.authorId ?? r.author_id);
  const categoryId = Number(r.Category_category_id ?? r.categoryId ?? r.category_id);
  const ebookName = String(r.eBookName ?? r.ebook_name ?? "");
  if (!id || !ebookName) return null;

  const authorObj = (r.author ?? {}) as Record<string, unknown>;
  const categoryObj = (r.category ?? {}) as Record<string, unknown>;
  const rawPdf = String(r.pdfFile ?? r.pdf_file ?? "").trim();
  return {
    ebook_id: id,
    ebook_name: ebookName,
    author_id: authorId,
    category_id: categoryId,
    release_date: (r.releaseDate as string | null) ?? (r.release_date as string | null) ?? null,
    description: String(r.description ?? ""),
    cover_image: String(r.coverImage ?? r.cover_image ?? ""),
    pdf_file: rawPdf,
    pdf_available: Boolean(rawPdf),
    author_name: String(authorObj.authorName ?? authorObj.author_name ?? ""),
    category_name: String(categoryObj.categoryName ?? categoryObj.category_name ?? ""),
    created_at: String(r.created_at ?? r.createdAt ?? ""),
    read_count: Math.max(0, Math.trunc(Number(r.readCount ?? r.read_count ?? 0))),
    summary_status: normalizeEbookSummaryStatus(r.summaryStatus ?? r.summary_status)
  };
}

export async function getEbooks(options?: { imported?: boolean }): Promise<EbookItem[]> {
  const params = options?.imported ? { imported: "true" } : undefined;
  const { data } = await api.get<ApiEnvelope<unknown[]>>("/ebooks", { params });
  const rows = Array.isArray(data.data) ? data.data : [];
  return rows.map(normalizeEbook).filter((x): x is EbookItem => x !== null);
}

export async function getEbookById(ebookId: number): Promise<EbookItem> {
  const { data } = await api.get<ApiEnvelope<unknown>>(`/ebooks/${ebookId}`);
  const row = normalizeEbook(data.data ?? {});
  if (!row) throw new Error("e-Book not found");
  return row;
}

/** Authenticated PDF read — direct /uploads/eBooks URLs are blocked server-side. */
export async function openEbookPdf(ebookId: number): Promise<void> {
  const response = await api.get(`/ebooks/${ebookId}/pdf`, {
    responseType: "blob",
    timeout: 120000
  });
  const blob = new Blob([response.data], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function downloadEbookPdf(ebookId: number, filename: string): Promise<void> {
  const response = await api.get(`/ebooks/${ebookId}/pdf`, {
    responseType: "blob",
    timeout: 120000
  });
  const blob = new Blob([response.data], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function getEbooksPage(options?: {
  page?: number;
  limit?: number;
  q?: string;
  category?: string;
  imported?: boolean;
  status?: string;
}): Promise<{
  items: EbookItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}> {
  const params: Record<string, string | number> = { paged: "true" };
  if (options?.page) params.page = options.page;
  if (options?.limit) params.limit = options.limit;
  if (options?.q) params.q = options.q;
  if (options?.category) params.category = options.category;
  if (options?.imported) params.imported = "true";
  if (options?.status) params.status = options.status;

  const { data } = await api.get<ApiEnvelope<unknown[]>>("/ebooks", { params });
  const rows = Array.isArray(data.data) ? data.data : [];
  const items = rows.map(normalizeEbook).filter((x): x is EbookItem => x !== null);
  const page = Math.max(1, Number(data.meta?.page ?? options?.page ?? 1));
  const limit = Math.max(1, Number(data.meta?.limit ?? options?.limit ?? 40));
  const total = Math.max(0, Number(data.meta?.total ?? items.length));
  const rawTotalPages = data.meta?.totalPages ?? Math.ceil(total / limit);
  const totalPages = Math.max(1, Number(rawTotalPages) || 1);
  const hasMore =
    typeof data.meta?.hasMore === "boolean" ? data.meta.hasMore : page < totalPages;
  return { items, page, limit, total, totalPages, hasMore };
}

/** Member-only: categories inferred from reads + favorites, else recent catalog. */
export async function getRecommendedEbooks(): Promise<EbookItem[]> {
  const { data } = await api.get<ApiEnvelope<unknown[]>>("/ebooks/recommended");
  const rows = Array.isArray(data.data) ? data.data : [];
  return rows.map(normalizeEbook).filter((x): x is EbookItem => x !== null);
}

export async function getMostPopularEbooks(): Promise<EbookItem[]> {
  const { data } = await api.get<ApiEnvelope<unknown[]>>("/ebooks/most-popular");
  const rows = Array.isArray(data.data) ? data.data : [];
  return rows.map(normalizeEbook).filter((x): x is EbookItem => x !== null);
}

export async function getNewUploads(): Promise<EbookItem[]> {
  const { data } = await api.get<ApiEnvelope<unknown[]>>("/ebooks/new-uploads");
  const rows = Array.isArray(data.data) ? data.data : [];
  return rows.map(normalizeEbook).filter((x): x is EbookItem => x !== null);
}

export async function trackEbookRead(ebookId: number): Promise<{ created: boolean; readCount: number }> {
  const { data } = await api.post<ApiEnvelope<{ created?: boolean; readCount?: number }>>(
    `/ebooks/${ebookId}/read`
  );
  return {
    created: Boolean(data.data?.created),
    readCount: Number(data.data?.readCount ?? 0)
  };
}

export type SummaryLanguage = "en" | "my";

export type EbookSummaryResult = {
  ebook_id: number;
  ai_summary: string;
  is_summarized: boolean;
  summary_status: string;
  summary_language: SummaryLanguage;
  source: "database" | "openai" | "none" | "processing";
};

const SUMMARY_REQUEST_TIMEOUT_MS = 600000;

function normalizeSummaryLanguage(raw: unknown): SummaryLanguage {
  const s = String(raw ?? "en")
    .trim()
    .toLowerCase();
  if (["my", "mm", "burmese", "my-mm", "my_mm"].includes(s)) return "my";
  return "en";
}

function unwrapSummaryPayload(envelope: unknown): unknown {
  if (!envelope || typeof envelope !== "object") return envelope;
  const e = envelope as Record<string, unknown>;
  if (e.data != null && typeof e.data === "object") return e.data;
  return envelope;
}

function pickSummaryText(raw: Record<string, unknown>, lang: SummaryLanguage): string {
  const direct = raw.aiSummary ?? raw.ai_summary ?? raw.summary;
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  if (lang === "my") {
    const my = raw.aiSummaryMy ?? raw.ai_summary_my;
    if (typeof my === "string" && my.trim()) return my.trim();
  } else {
    const en = raw.aiSummaryEn ?? raw.ai_summary_en;
    if (typeof en === "string" && en.trim()) return en.trim();
  }

  return "";
}

function normalizeEbookSummary(raw: unknown, ebookId: number): EbookSummaryResult {
  const r = unwrapSummaryPayload(raw) as Record<string, unknown>;
  const summary_language = normalizeSummaryLanguage(r.summaryLanguage ?? r.summary_language ?? r.lang);
  const ai_summary = pickSummaryText(r, summary_language);
  const is_summarized = Boolean(r.isSummarized ?? r.is_summarized) || ai_summary.length > 0;
  return {
    ebook_id: Number(r.eBooksId ?? r.eBooks_id ?? r.ebook_id ?? ebookId),
    ai_summary,
    is_summarized,
    summary_status: String(r.summaryStatus ?? r.summary_status ?? (ai_summary ? "completed" : "pending")),
    summary_language,
    source: (r.source as EbookSummaryResult["source"]) ?? (ai_summary ? "database" : "none")
  };
}

/** GET /ebooks/:id/summary — `cachedOnly` reads DB only; otherwise generates via OpenAI when missing. */
export async function getEbookSummary(
  ebookId: number,
  options?: { lang?: SummaryLanguage; cachedOnly?: boolean }
): Promise<EbookSummaryResult> {
  const params: Record<string, string> = {};
  if (options?.lang) params.lang = options.lang;
  if (options?.cachedOnly) params.cachedOnly = "true";

  const { data } = await summaryApi.get<ApiEnvelope<unknown>>(`/ebooks/${ebookId}/summary`, {
    params,
    timeout: options?.cachedOnly ? 60000 : SUMMARY_REQUEST_TIMEOUT_MS
  });
  return normalizeEbookSummary(data, ebookId);
}

/** Same flow as the mobile app: one request, long timeout, server caches result in DB. */
export async function generateEbookSummary(
  ebookId: number,
  options?: { lang?: SummaryLanguage }
): Promise<EbookSummaryResult> {
  const cached = await getEbookSummary(ebookId, { lang: options?.lang, cachedOnly: true });
  if (cached.ai_summary) return cached;

  const params: Record<string, string> = {};
  if (options?.lang) params.lang = options.lang;

  const { data } = await summaryApi.get<ApiEnvelope<unknown>>(`/ebooks/${ebookId}/summary`, {
    params,
    timeout: SUMMARY_REQUEST_TIMEOUT_MS
  });
  const result = normalizeEbookSummary(data, ebookId);
  if (!result.ai_summary) {
    if (result.summary_status === "processing") {
      throw new Error("Summary is still processing. Please wait a moment and try again.");
    }
    throw new Error("Summary generation failed. Please try again.");
  }
  return result;
}

export function buildCoverThumbnailUrl(
  coverUrl: string | null | undefined,
  options?: { width?: number; quality?: number }
): string {
  const fallback = "/sidebar-admin-icon.png";
  const raw = String(coverUrl ?? "").trim();
  if (!raw) return fallback;
  if (!raw.startsWith("/uploads/covers/")) return raw;
  const w = Math.min(640, Math.max(80, Number(options?.width ?? 220)));
  const q = Math.min(95, Math.max(40, Number(options?.quality ?? 70)));
  const separator = raw.includes("?") ? "&" : "?";
  return `${raw}${separator}thumb=1&w=${w}&q=${q}`;
}

function normalizeFavorite(raw: unknown): FavoriteItem | null {
  const r = raw as Record<string, unknown>;
  const favoriteId = Number(r.favoriteId ?? r.favorite_id);
  const ebook = normalizeEbook(r.ebook);
  if (!favoriteId || !ebook) return null;
  return { favorite_id: favoriteId, ebook };
}

export async function toggleFavorite(ebookId: number): Promise<{ favorited: boolean }> {
  const { data } = await api.post<ApiEnvelope<{ favorited?: boolean }>>("/favorites/toggle", { ebookId });
  return { favorited: Boolean(data.data?.favorited) };
}

export async function getFavorites(): Promise<FavoriteItem[]> {
  const { data } = await api.get<ApiEnvelope<unknown[]>>("/favorites");
  const rows = Array.isArray(data.data) ? data.data : [];
  return rows.map(normalizeFavorite).filter((x): x is FavoriteItem => x !== null);
}

export async function createEbook(payload: EbookPayload): Promise<void> {
  const form = new FormData();
  form.append("eBookName", payload.ebook_name);
  if (payload.author_id) {
    const id = String(payload.author_id);
    form.append("authorId", id);
    form.append("author_id", id);
  }
  if (payload.author_name) {
    form.append("authorName", payload.author_name);
    form.append("author_name", payload.author_name);
  }
  if (payload.category_id) {
    const id = String(payload.category_id);
    form.append("categoryId", id);
    form.append("category_id", id);
  }
  if (payload.category_name) {
    form.append("categoryName", payload.category_name);
    form.append("category_name", payload.category_name);
  }
  if (payload.release_date) form.append("releaseDate", payload.release_date);
  if (payload.description) form.append("description", payload.description);
  if (payload.cover_file) form.append("cover", payload.cover_file);
  if (payload.pdf_file) form.append("pdf", payload.pdf_file);
  for (const pair of form.entries()) {
    // temporary debug for multipart payload
    // eslint-disable-next-line no-console
    console.log(pair[0], pair[1]);
  }
  await api.post("/ebooks", form, { headers: { "Content-Type": "multipart/form-data" } });
}

export async function updateEbook(id: number, payload: EbookPayload): Promise<void> {
  const form = new FormData();
  form.append("eBookName", payload.ebook_name);
  if (payload.author_id) {
    const authorId = String(payload.author_id);
    form.append("authorId", authorId);
    form.append("author_id", authorId);
  }
  if (payload.category_id) {
    const categoryId = String(payload.category_id);
    form.append("categoryId", categoryId);
    form.append("category_id", categoryId);
  }
  if (payload.author_name) {
    form.append("authorName", payload.author_name);
    form.append("author_name", payload.author_name);
  }
  if (payload.category_name) {
    form.append("categoryName", payload.category_name);
    form.append("category_name", payload.category_name);
  }
  if (payload.release_date) form.append("releaseDate", payload.release_date);
  if (payload.description) form.append("description", payload.description);
  if (payload.cover_file) form.append("cover", payload.cover_file);
  if (payload.pdf_file) form.append("pdf", payload.pdf_file);
  await api.put(`/ebooks/${id}`, form, { headers: { "Content-Type": "multipart/form-data" } });
}

export async function deleteEbook(id: number): Promise<void> {
  await api.delete(`/ebooks/${id}`);
}

/* ——— Categories CRUD ——— */

export type CategoryPayload = { category_name: string };

export async function createCategory(payload: CategoryPayload): Promise<void> {
  await api.post("/categories", { categoryName: payload.category_name });
}

export async function updateCategory(id: number, payload: CategoryPayload): Promise<void> {
  await api.put(`/categories/${id}`, { categoryName: payload.category_name });
}

export async function deleteCategory(id: number): Promise<void> {
  await api.delete(`/categories/${id}`);
}

/* ——— Authors CRUD ——— */

export type AuthorPayload = { author_name: string; country: string };

export async function createAuthor(payload: AuthorPayload): Promise<void> {
  await api.post("/authors", {
    authorName: payload.author_name,
    country: payload.country?.trim() ? payload.country.trim() : null
  });
}

export async function updateAuthor(id: number, payload: AuthorPayload): Promise<void> {
  await api.put(`/authors/${id}`, {
    authorName: payload.author_name,
    country: payload.country?.trim() ? payload.country.trim() : null
  });
}

export async function deleteAuthor(id: number): Promise<void> {
  await api.delete(`/authors/${id}`);
}

/* ——— Departments (admin) ——— */

export type DepartmentPayload = { department_name: string };

export type DepartmentItem = {
  department_id: number;
  department_name: string;
  user_dependency_count: number;
  is_deleted?: boolean;
};

function normalizeDepartmentAdmin(raw: unknown): DepartmentItem | null {
  const r = raw as Record<string, unknown>;
  const id = Number(r.departmentId ?? r.department_id);
  const name = String(r.departmentName ?? r.department_name ?? "");
  if (!Number.isFinite(id) || id < 1 || !name.trim()) return null;
  const userDep = Number(r.userDependencyCount ?? r.user_dependency_count ?? 0);
  return {
    department_id: Math.trunc(id),
    department_name: name,
    user_dependency_count: Number.isFinite(userDep) ? userDep : 0,
    is_deleted: Boolean(r.isDeleted ?? r.is_deleted)
  };
}

export type DepartmentDependencies = { users: number; books: number };

export async function getDepartmentDependencies(id: number): Promise<DepartmentDependencies> {
  const { data } = await api.get<ApiEnvelope<DepartmentDependencies>>(`/departments/${id}/dependencies`);
  const d = data.data;
  return {
    users: Number(d?.users ?? 0),
    books: Number(d?.books ?? 0)
  };
}

export async function getDepartmentList(includeDeleted = false): Promise<DepartmentItem[]> {
  const { data } = await api.get<ApiEnvelope<unknown[]>>("/departments", {
    params: includeDeleted ? { includeDeleted: true } : undefined
  });
  const rows = Array.isArray(data.data) ? data.data : [];
  return rows.map(normalizeDepartmentAdmin).filter((x): x is DepartmentItem => x !== null);
}

export type CreateDepartmentResult = { restored: boolean; message?: string };

export async function createDepartment(payload: DepartmentPayload): Promise<CreateDepartmentResult> {
  const { data } = await api.post<ApiEnvelope<unknown>>("/departments", {
    departmentName: payload.department_name
  });
  return {
    restored: Boolean(data.meta?.restored),
    message: typeof data.message === "string" ? data.message : undefined
  };
}

export async function restoreDepartment(id: number): Promise<void> {
  await api.put(`/departments/${id}/restore`);
}

export async function updateDepartment(id: number, payload: DepartmentPayload): Promise<void> {
  await api.put(`/departments/${id}`, { departmentName: payload.department_name });
}

export async function deleteDepartment(id: number): Promise<void> {
  await api.delete(`/departments/${id}`);
}

/* ——— Users CRUD + approval ——— */

export type UserItem = {
  usersId: number;
  userName: string;
  email: string;
  dateOfBirth: string;
  status: string;
  department_department_id: number;
  activeRentalCount: number;
  isDeleted?: boolean;
  department?: {
    departmentId: number;
    departmentName: string;
  };
};

export type UserPayload = {
  userName: string;
  email: string;
  dateOfBirth: string;
  departmentId: number;
  password?: string;
};

function normalizeUser(raw: unknown): UserItem | null {
  const r = raw as Record<string, unknown>;
  const usersId = Number(r.usersId ?? r.users_id);
  const userName = String(r.userName ?? r.user_name ?? "");
  if (!usersId || !userName.trim()) return null;

  const deptRaw = (r.department ?? {}) as Record<string, unknown>;
  const deptId = Number(deptRaw.departmentId ?? deptRaw.department_id);
  const deptName = String(deptRaw.departmentName ?? deptRaw.department_name ?? "");

  const rentals = Number(r.activeRentalCount ?? r.active_rental_count ?? 0);
  return {
    usersId,
    userName,
    email: String(r.email ?? ""),
    dateOfBirth: String(r.dateOfBirth ?? r.date_of_birth ?? ""),
    status: String(r.status ?? "PENDING"),
    department_department_id: Number(r.department_department_id ?? r.departmentId ?? 0),
    activeRentalCount: Number.isFinite(rentals) ? rentals : 0,
    isDeleted: Boolean(r.isDeleted ?? r.is_deleted),
    department:
      deptId > 0 || deptName.trim()
        ? {
            departmentId: deptId || Number(r.department_department_id ?? 0),
            departmentName: deptName
          }
        : undefined
  };
}

export async function getUsers(includeDeleted = false): Promise<UserItem[]> {
  const { data } = await api.get<ApiEnvelope<unknown[]>>("/users", {
    params: includeDeleted ? { includeDeleted: true } : undefined
  });
  const rows = Array.isArray(data.data) ? data.data : [];
  return rows.map(normalizeUser).filter((x): x is UserItem => x !== null);
}

export async function createUser(payload: UserPayload): Promise<void> {
  await api.post("/users", payload);
}

export async function updateUser(id: number, payload: UserPayload): Promise<void> {
  await api.put(`/users/${id}`, payload);
}

export async function deleteUser(id: number): Promise<void> {
  await api.delete(`/users/${id}`);
}

export async function acceptUser(id: number): Promise<void> {
  await api.put(`/admin/users/${id}/approve`);
}

export async function rejectUser(id: number): Promise<void> {
  await api.put(`/admin/users/${id}/reject`);
}

/* ——— Rent list (admin) ——— */

export type RentItem = {
  rent_list_id: number;
  rent_date: string;
  due_date: string;
  return_date: string | null;
  Books_book_id: number;
  Users_users_id: number;
  book_name?: string;
  user_name?: string;
};

export type RentPayload = {
  bookId: number;
  usersId: number;
  rentDate: string;
  dueDate: string;
  /** Omit or `null` when book is still out (admin edit). */
  returnDate?: string | null;
};

function normalizeRent(raw: unknown): RentItem | null {
  const r = raw as Record<string, unknown>;
  const id = Number(r.rentListId ?? r.rent_list_id);
  if (!id) return null;
  const book = (r.book ?? {}) as Record<string, unknown>;
  const user = (r.user ?? {}) as Record<string, unknown>;
  const ret = r.returnDate ?? r.return_date;
  return {
    rent_list_id: id,
    rent_date: String(r.rentDate ?? r.rent_date ?? "").slice(0, 10),
    due_date: String(r.dueDate ?? r.due_date ?? "").slice(0, 10),
    return_date: ret != null && ret !== "" ? String(ret).slice(0, 10) : null,
    Books_book_id: Number(r.Books_book_id ?? r.books_book_id ?? book.bookId ?? book.book_id ?? 0),
    Users_users_id: Number(r.Users_users_id ?? r.users_users_id ?? user.usersId ?? user.users_id ?? 0),
    book_name: String(book.bookName ?? book.book_name ?? ""),
    user_name: String(user.userName ?? user.user_name ?? "")
  };
}

export async function getRentList(): Promise<RentItem[]> {
  const { data } = await api.get<ApiEnvelope<unknown[]>>("/rent");
  const rows = Array.isArray(data.data) ? data.data : [];
  return rows.map(normalizeRent).filter((x): x is RentItem => x !== null);
}

export async function createRent(payload: RentPayload): Promise<void> {
  await api.post("/rent", {
    bookId: payload.bookId,
    usersId: payload.usersId,
    rentDate: payload.rentDate || undefined,
    dueDate: payload.dueDate || undefined
  });
}

export async function updateRent(id: number, payload: RentPayload): Promise<void> {
  await api.put(`/rent/${id}`, {
    bookId: payload.bookId,
    usersId: payload.usersId,
    rentDate: payload.rentDate,
    dueDate: payload.dueDate,
    returnDate: payload.returnDate === undefined ? undefined : payload.returnDate
  });
}

export async function deleteRent(id: number): Promise<void> {
  await api.delete(`/rent/${id}`);
}

/** Sets return date to today (member or admin per backend rules). */
export async function returnRentBook(id: number): Promise<void> {
  await api.patch(`/rent/${id}/return`);
}

export type AdminTier = "SUPER_ADMIN" | "ADMIN";

export type AdminProfile = {
  adminId: number;
  userName: string;
  email: string;
  role?: AdminTier;
};

export type AdminAccount = {
  adminId: number;
  adminName: string;
  role: AdminTier;
};

export type CreateAdminPayload = {
  adminName: string;
  password: string;
  role?: AdminTier;
};

export type UpdateAdminPayload = {
  adminName?: string;
  password?: string;
  role?: AdminTier;
};

type AdminProfilePayload = { userName: string; email: string };
type ChangeAdminPasswordPayload = { currentPassword: string; newPassword: string };
export type MemberProfileMe = {
  usersId: number;
  userName: string;
  email: string;
  dateOfBirth: string;
  departmentId: number;
};

export type UpdateMemberProfilePayload = {
  userName: string;
  email?: string;
  dateOfBirth?: string;
  departmentId: number;
};

type ChangeUserPasswordPayload = { currentPassword: string; newPassword: string };

function normalizeMemberMe(raw: unknown): MemberProfileMe {
  const r = raw as Record<string, unknown>;
  const dept = (r.department ?? {}) as Record<string, unknown>;
  const deptId = Number(
    r.department_department_id ??
      r.departmentId ??
      r.department_id ??
      dept.departmentId ??
      dept.department_id
  );
  const dob = r.dateOfBirth ?? r.date_of_birth;
  return {
    usersId: Math.trunc(Number(r.usersId ?? r.users_id ?? 0)),
    userName: String(r.userName ?? r.user_name ?? ""),
    email: String(r.email ?? ""),
    dateOfBirth: dob ? String(dob).slice(0, 10) : "",
    departmentId: Number.isFinite(deptId) && deptId > 0 ? Math.trunc(deptId) : 0
  };
}

export function readAdminIdFromToken(): number | null {
  try {
    const token = localStorage.getItem("token");
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = JSON.parse(atob(parts[1])) as Record<string, unknown>;
    const id = Number(payload.userId ?? payload.sub);
    return Number.isFinite(id) && id > 0 ? Math.trunc(id) : null;
  } catch {
    return null;
  }
}

function normalizeAdminTier(raw: unknown): AdminTier | undefined {
  if (raw === "SUPER_ADMIN" || raw === "ADMIN") return raw;
  return undefined;
}

function normalizeAdminProfile(raw: unknown): AdminProfile {
  const r = raw as Record<string, unknown>;
  return {
    adminId: Math.trunc(Number(r.adminId ?? r.admin_id ?? 0)),
    userName: String(r.userName ?? r.adminName ?? r.admin_name ?? ""),
    email: String(r.email ?? ""),
    role: normalizeAdminTier(r.role)
  };
}

function normalizeAdminAccount(raw: unknown): AdminAccount | null {
  const r = raw as Record<string, unknown>;
  const adminId = Math.trunc(Number(r.adminId ?? r.admin_id ?? 0));
  if (!adminId) return null;
  const role = normalizeAdminTier(r.role) ?? "ADMIN";
  return {
    adminId,
    adminName: String(r.adminName ?? r.admin_name ?? ""),
    role
  };
}

export async function listAdminAccounts(): Promise<AdminAccount[]> {
  const { data } = await api.get<ApiEnvelope<unknown[]>>("/admins");
  const rows = Array.isArray(data.data) ? data.data : [];
  return rows.map(normalizeAdminAccount).filter((x): x is AdminAccount => x !== null);
}

export async function createAdminAccount(payload: CreateAdminPayload): Promise<AdminAccount> {
  const { data } = await api.post<ApiEnvelope<unknown>>("/admins", payload);
  const row = normalizeAdminAccount(data.data ?? {});
  if (!row) throw new Error("Invalid admin create response");
  return row;
}

export async function updateAdminAccount(adminId: number, payload: UpdateAdminPayload): Promise<AdminAccount> {
  const { data } = await api.put<ApiEnvelope<unknown>>(`/admins/${adminId}`, payload);
  const row = normalizeAdminAccount(data.data ?? {});
  if (!row) throw new Error("Invalid admin update response");
  return row;
}

export async function deleteAdminAccount(adminId: number): Promise<void> {
  await api.delete(`/admins/${adminId}`);
}

export async function getAdminProfile(): Promise<AdminProfile> {
  try {
    const { data } = await api.get<ApiEnvelope<unknown>>("/admin/profile");
    return normalizeAdminProfile(data.data ?? {});
  } catch (e) {
    if (!axios.isAxiosError(e) || e.response?.status !== 404) throw e;
    const adminId = readAdminIdFromToken();
    if (!adminId) throw e;
    const { data } = await api.get<ApiEnvelope<unknown>>(`/admins/${adminId}`);
    return normalizeAdminProfile(data.data ?? {});
  }
}

export async function updateAdminProfile(payload: AdminProfilePayload): Promise<AdminProfile> {
  try {
    const { data } = await api.put<ApiEnvelope<unknown>>("/admin/profile", payload);
    return normalizeAdminProfile(data.data ?? {});
  } catch (e) {
    if (!axios.isAxiosError(e) || e.response?.status !== 404) throw e;
    const adminId = readAdminIdFromToken();
    if (!adminId) throw e;
    const { data } = await api.put<ApiEnvelope<unknown>>(`/admins/${adminId}`, {
      adminName: payload.userName
    });
    return normalizeAdminProfile(data.data ?? {});
  }
}

export async function changeAdminPassword(payload: ChangeAdminPasswordPayload): Promise<void> {
  await api.put("/admin/change-password", payload);
}

export async function getCurrentMemberProfile(): Promise<MemberProfileMe> {
  const { data } = await api.get<ApiEnvelope<unknown>>("/users/me");
  return normalizeMemberMe(data.data ?? {});
}

export async function updateMyProfile(payload: UpdateMemberProfilePayload): Promise<MemberProfileMe> {
  const { data } = await api.put<ApiEnvelope<unknown>>("/users/me", payload);
  return normalizeMemberMe(data.data ?? {});
}

export async function changeUserPassword(payload: ChangeUserPasswordPayload): Promise<void> {
  await api.put("/users/me/password", payload);
}

export type TimezoneGroup = { region: string; zones: string[] };

export type AppSettings = {
  timezone: string;
  offset: string;
  now: string;
  today: string;
  groups: TimezoneGroup[];
  /** When true, new Google Sign-In users stay PENDING until admin Accept. */
  googleJoinRequireApproval: boolean;
  /** Auto-approved Google joins (mode OFF) waiting for admin acknowledgement. */
  unseenAutoJoinIds: number[];
  unseenAutoJoinCount: number;
};

export type BackupFile = {
  fileName: string;
  size: number;
  createdAt: string;
};

function unwrapSettings(raw: unknown): AppSettings {
  const r = (raw ?? {}) as Record<string, unknown>;
  const approvalRaw = r.googleJoinRequireApproval ?? r.google_join_require_approval;
  const joinIdsRaw = r.unseenAutoJoinIds ?? r.unseen_auto_join_ids;
  const unseenAutoJoinIds = Array.isArray(joinIdsRaw)
    ? [
        ...new Set(
          joinIdsRaw
            .map((id) => Number(id))
            .filter((id) => Number.isFinite(id) && id > 0),
        ),
      ]
    : [];
  const countRaw = Number(r.unseenAutoJoinCount ?? r.unseen_auto_join_count);
  return {
    timezone: String(r.timezone ?? "Asia/Yangon"),
    offset: String(r.offset ?? ""),
    now: String(r.now ?? ""),
    today: String(r.today ?? ""),
    groups: Array.isArray(r.groups) ? (r.groups as TimezoneGroup[]) : [],
    googleJoinRequireApproval:
      approvalRaw === true ||
      approvalRaw === 1 ||
      String(approvalRaw ?? "true").toLowerCase() === "true",
    unseenAutoJoinIds,
    unseenAutoJoinCount: Number.isFinite(countRaw) ? countRaw : unseenAutoJoinIds.length,
  };
}

export async function getAppSettings(): Promise<AppSettings> {
  const { data } = await api.get<ApiEnvelope<unknown>>("/settings");
  return unwrapSettings(data.data);
}

export async function updateAppTimezone(timezone: string): Promise<AppSettings> {
  const { data } = await api.put<ApiEnvelope<unknown>>("/settings/timezone", { timezone });
  return unwrapSettings(data.data);
}

export async function updateGoogleJoinRequireApproval(
  googleJoinRequireApproval: boolean,
): Promise<AppSettings> {
  const { data } = await api.put<ApiEnvelope<unknown>>("/settings/google-join-approval", {
    googleJoinRequireApproval,
  });
  return unwrapSettings(data.data);
}

export async function clearUserJoinNotices(): Promise<AppSettings> {
  const { data } = await api.post<ApiEnvelope<unknown>>("/settings/user-join-notices/read");
  return unwrapSettings(data.data);
}

const backupTimeout = 300000;

export async function listBackups(): Promise<BackupFile[]> {
  const { data } = await api.get<ApiEnvelope<BackupFile[]>>("/settings/backups");
  return Array.isArray(data.data) ? data.data : [];
}

export async function createBackup(): Promise<BackupFile> {
  const { data } = await api.post<ApiEnvelope<BackupFile>>("/settings/backups", {}, { timeout: backupTimeout });
  return data.data as BackupFile;
}

export async function downloadBackupFile(fileName: string): Promise<void> {
  const { data } = await api.get<Blob>(`/settings/backups/${encodeURIComponent(fileName)}`, {
    responseType: "blob",
    timeout: backupTimeout
  });
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function restoreBackupFile(fileName: string): Promise<void> {
  await api.post(`/settings/backups/${encodeURIComponent(fileName)}/restore`, {}, { timeout: backupTimeout });
}

export async function restoreBackupUpload(file: File): Promise<void> {
  const form = new FormData();
  form.append("file", file);
  await api.post("/settings/restore", form, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: backupTimeout
  });
}

export async function deleteBackupFile(fileName: string): Promise<void> {
  await api.delete(`/settings/backups/${encodeURIComponent(fileName)}`);
}

export default api;
