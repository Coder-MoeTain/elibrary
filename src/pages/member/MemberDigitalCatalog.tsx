import { motion } from "framer-motion";
import { Eye, Heart, LayoutGrid, List, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import PageHeader from "../../components/ui/PageHeader";
import TablePagination from "../../components/ui/TablePagination";
import { Table } from "../../components/ui/Table";
import {
  buildCoverThumbnailUrl,
  EbookContentType,
  EbookItem,
  getApiErrorMessage,
  getCategories,
  getEbooksPage,
  getFavorites,
  toggleFavorite
} from "../../services/api";

type Toast = { kind: "success" | "error"; message: string } | null;
type ViewMode = "grid" | "list";

const FALLBACK_COVER = "/sidebar-admin-icon.png";
const COVER_RETRY_MAX = 2;
/** Desktop: 6 columns; 12 → 2 rows, 24 → 4 rows. Cards shrink to fit viewport. */
const DEFAULT_LIMIT = 12;
const PAGE_SIZE_OPTIONS = [12, 24];
const DESKTOP_COLS = 6;

function desktopRowsForLimit(pageLimit: number): number {
  return Math.max(1, Math.ceil(pageLimit / DESKTOP_COLS));
}

function catalogGridClass(compact: boolean): string {
  return [
    "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6",
    "lg:h-full lg:min-h-0 lg:[grid-template-rows:repeat(var(--catalog-rows),minmax(0,1fr))]",
    compact ? "gap-1.5 lg:gap-1.5" : "gap-3 lg:gap-2.5"
  ].join(" ");
}

function catalogCardClass(compact: boolean): string {
  return [
    "relative flex h-full min-h-0 flex-col border border-slate-200/60 bg-white/70 shadow-md backdrop-blur-md transition hover:shadow-lg dark:border-slate-700 dark:bg-slate-800/70",
    compact ? "rounded-lg p-1" : "rounded-xl p-2"
  ].join(" ");
}

function catalogCoverClass(compact: boolean): string {
  return [
    "min-h-0 flex-1 overflow-hidden bg-slate-100 aspect-[3/4] lg:aspect-auto dark:bg-slate-700/70",
    compact ? "mb-1 rounded-md" : "mb-1.5 rounded-lg"
  ].join(" ");
}

type EbookRow = Record<string, unknown> & {
  id: number;
  ebook_name: string;
  cover_image: string;
  author_name: string;
  category_name: string;
};

export type MemberDigitalCatalogProps = {
  contentType: EbookContentType;
  title: string;
  description: string;
  listStateKey: string;
  detailBasePath: string;
  searchPlaceholder: string;
  emptyMessage: string;
  ariaSearchLabel: string;
};

function withRetryBuster(url: string, attempt: number): string {
  if (!url || attempt <= 0) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}r=${attempt}`;
}

function parsePositiveInt(raw: string | null, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.trunc(n) : fallback;
}

function buildListSearchParams(input: {
  page: number;
  limit: number;
  q: string;
  category: string;
  view: ViewMode;
}): URLSearchParams {
  const next = new URLSearchParams();
  if (input.page > 1) next.set("page", String(input.page));
  if (input.limit !== DEFAULT_LIMIT) next.set("limit", String(input.limit));
  const trimmedQ = input.q.trim();
  if (trimmedQ) next.set("q", trimmedQ);
  if (input.category !== "All Categories") next.set("category", input.category);
  if (input.view === "list") next.set("view", "list");
  return next;
}

const MemberDigitalCatalog = ({
  contentType,
  title,
  description,
  listStateKey,
  detailBasePath,
  searchPlaceholder,
  emptyMessage,
  ariaSearchLabel
}: MemberDigitalCatalogProps) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState<EbookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryOptions, setCategoryOptions] = useState<string[]>(["All Categories"]);
  const [toast, setToast] = useState<Toast>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const [totalFiltered, setTotalFiltered] = useState(0);

  const page = parsePositiveInt(searchParams.get("page"), 1);
  const rawLimit = parsePositiveInt(searchParams.get("limit"), DEFAULT_LIMIT);
  const limit = PAGE_SIZE_OPTIONS.includes(rawLimit) ? rawLimit : DEFAULT_LIMIT;
  const q = searchParams.get("q") ?? "";
  const selectedCategory = searchParams.get("category") ?? "All Categories";
  const viewMode: ViewMode = searchParams.get("view") === "list" ? "list" : "grid";
  const desktopRows = desktopRowsForLimit(limit);
  const compactCards = limit >= 24;
  const gridClass = catalogGridClass(compactCards);
  const cardClass = catalogCardClass(compactCards);
  const coverClass = catalogCoverClass(compactCards);
  const gridStyle = { ["--catalog-rows" as string]: String(desktopRows) };

  const listSearch = searchParams.toString() ? `?${searchParams.toString()}` : "";

  const updateListParams = (
    patch: Partial<{ page: number; limit: number; q: string; category: string; view: ViewMode }>
  ) => {
    const next = buildListSearchParams({
      page: patch.page ?? page,
      limit: patch.limit ?? limit,
      q: patch.q !== undefined ? patch.q : q,
      category: patch.category ?? selectedCategory,
      view: patch.view ?? viewMode
    });
    setSearchParams(next, { replace: true });
  };

  const goToDetail = (ebookId: number) => {
    sessionStorage.setItem(listStateKey, listSearch);
    navigate(`${detailBasePath}/${ebookId}`, {
      state: { ebooksListSearch: listSearch }
    });
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const result = await getEbooksPage({
          page,
          limit,
          q: q.trim() || undefined,
          category: selectedCategory !== "All Categories" ? selectedCategory : undefined,
          contentType
        });
        if (!cancelled) {
          setRows(result.items);
          setTotalFiltered(result.total);
        }
      } catch (err) {
        if (!cancelled) setToast({ kind: "error", message: getApiErrorMessage(err) });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [page, limit, q, selectedCategory, contentType]);

  useEffect(() => {
    let cancelled = false;
    const loadFavorites = async () => {
      try {
        const favorites = await getFavorites();
        if (!cancelled) {
          setFavoriteIds(new Set(favorites.map((f) => f.ebook.ebook_id)));
        }
      } catch (err) {
        if (!cancelled) setToast({ kind: "error", message: getApiErrorMessage(err) });
      }
    };
    void loadFavorites();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleFavorite = async (id: number) => {
    try {
      const result = await toggleFavorite(id);
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (result.favorited) next.add(id);
        else next.delete(id);
        return next;
      });
    } catch (err) {
      setToast({ kind: "error", message: getApiErrorMessage(err) });
    }
  };

  useEffect(() => {
    let cancelled = false;
    const loadCategories = async () => {
      try {
        const cats = await getCategories({ counts: true });
        if (!cancelled) {
          const names = cats
            .filter((c) =>
              contentType === "paper" ? (c.paper_count ?? 0) > 0 : (c.ebook_count ?? 0) > 0
            )
            .map((c) => c.category_name)
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b));
          setCategoryOptions(["All Categories", ...names]);
        }
      } catch (err) {
        if (!cancelled) setToast({ kind: "error", message: getApiErrorMessage(err) });
      }
    };
    void loadCategories();
    return () => {
      cancelled = true;
    };
  }, [contentType]);

  useEffect(() => {
    const totalPages = totalFiltered === 0 ? 1 : Math.ceil(totalFiltered / limit);
    if (page > totalPages) {
      setSearchParams(
        buildListSearchParams({
          page: totalPages,
          limit,
          q,
          category: selectedCategory,
          view: viewMode
        }),
        { replace: true }
      );
    }
  }, [totalFiltered, limit, page, q, selectedCategory, viewMode, setSearchParams]);

  const tableRows: EbookRow[] = rows.map((book) => ({
    id: book.ebook_id,
    ebook_name: book.ebook_name,
    cover_image: book.cover_image ?? "",
    author_name: book.author_name || "Unknown author",
    category_name: book.category_name || "-"
  }));

  const columns = [
    { key: "ebook_name" as const, title: "Title" },
    {
      key: "cover_image" as const,
      title: "Cover",
      render: (row: EbookRow) => (
        <div className="h-16 w-12 overflow-hidden rounded-md border border-slate-200 bg-slate-100 dark:border-slate-600 dark:bg-slate-700">
          <img
            src={buildCoverThumbnailUrl(row.cover_image, { width: 96, quality: 65 }) || FALLBACK_COVER}
            alt={row.ebook_name}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            data-retry="0"
            onError={(e) => {
              const img = e.currentTarget as HTMLImageElement;
              const retry = Number(img.dataset.retry || "0");
              const source = buildCoverThumbnailUrl(row.cover_image, { width: 96, quality: 65 });
              if (source && retry < COVER_RETRY_MAX) {
                const next = retry + 1;
                img.dataset.retry = String(next);
                img.src = withRetryBuster(source, next);
                return;
              }
              img.src = FALLBACK_COVER;
            }}
            className="h-full w-full object-cover"
          />
        </div>
      )
    },
    { key: "author_name" as const, title: "Author" },
    { key: "category_name" as const, title: "Category" },
    {
      key: "id" as const,
      title: "Actions",
      render: (row: EbookRow) => (
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          title="View"
          onClick={() => goToDetail(row.id)}
        >
          <Eye className="h-4 w-4" />
        </button>
      )
    }
  ];

  return (
    <div className="flex min-h-0 flex-col gap-3 lg:h-[calc(100dvh-9rem)] lg:overflow-hidden lg:gap-2.5">
      <div className="shrink-0 space-y-3 lg:space-y-2">
        <PageHeader
          title={title}
          description={description}
          actions={
            <select
              value={selectedCategory}
              onChange={(e) => updateListParams({ category: e.target.value, page: 1 })}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              aria-label="Filter by category"
            >
              {categoryOptions.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          }
        />

        {toast && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-200">
            {toast.message}
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={q}
              onChange={(e) => updateListParams({ q: e.target.value, page: 1 })}
              placeholder={searchPlaceholder}
              className="pl-10"
              aria-label={ariaSearchLabel}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                viewMode === "grid"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
              onClick={() => updateListParams({ view: "grid" })}
            >
              <LayoutGrid className="h-4 w-4" />
              Grid
            </button>
            <button
              type="button"
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                viewMode === "list"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
              onClick={() => updateListParams({ view: "list" })}
            >
              <List className="h-4 w-4" />
              List
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className={`min-h-0 flex-1 ${gridClass}`} style={gridStyle}>
          {Array.from({ length: limit }, (_, i) => i).map((item) => (
            <div key={item} className={`${cardClass} animate-pulse`}>
              <div className={`${coverClass} bg-slate-200 dark:bg-slate-700`} />
              <div className="h-3 w-4/5 rounded bg-slate-200 dark:bg-slate-700" />
              {!compactCards ? (
                <div className="mt-1 h-2.5 w-1/2 rounded bg-slate-200 dark:bg-slate-700" />
              ) : null}
              <div className={`mt-1 w-full rounded-lg bg-slate-200 dark:bg-slate-700 ${compactCards ? "h-6" : "h-8"}`} />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/60 bg-white/70 p-8 text-center text-sm text-slate-500 shadow-lg backdrop-blur-md dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300">
          {emptyMessage}
        </div>
      ) : viewMode === "grid" ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <div className={`min-h-0 flex-1 ${gridClass}`} style={gridStyle}>
            {rows.map((book, idx) => (
              <motion.div
                key={book.ebook_id}
                initial={false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.01 }}
                className={cardClass}
              >
                <button
                  type="button"
                  onClick={() => void handleFavorite(book.ebook_id)}
                  className={`absolute z-10 rounded-full bg-white text-red-500 shadow transition hover:scale-110 dark:bg-slate-900 ${
                    compactCards ? "right-1 top-1 p-0.5" : "right-1.5 top-1.5 p-1"
                  }`}
                  aria-label={favoriteIds.has(book.ebook_id) ? "Remove from favorites" : "Add to favorites"}
                  title={favoriteIds.has(book.ebook_id) ? "Remove from favorites" : "Add to favorites"}
                >
                  <Heart
                    className={`${compactCards ? "h-3 w-3" : "h-3.5 w-3.5"} ${
                      favoriteIds.has(book.ebook_id) ? "fill-current" : ""
                    }`}
                  />
                </button>
                <div className={coverClass}>
                  {book.cover_image ? (
                    <img
                      src={buildCoverThumbnailUrl(book.cover_image, {
                        width: compactCards ? 160 : 240,
                        quality: 65
                      })}
                      alt={book.ebook_name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      data-retry="0"
                      onError={(e) => {
                        const img = e.currentTarget as HTMLImageElement;
                        const retry = Number(img.dataset.retry || "0");
                        const source = buildCoverThumbnailUrl(book.cover_image, {
                          width: compactCards ? 160 : 240,
                          quality: 65
                        });
                        if (source && retry < COVER_RETRY_MAX) {
                          const next = retry + 1;
                          img.dataset.retry = String(next);
                          img.src = withRetryBuster(source, next);
                          return;
                        }
                        img.src = FALLBACK_COVER;
                      }}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[10px] font-semibold text-slate-500 dark:text-slate-300">
                      No Cover
                    </div>
                  )}
                </div>
                <p
                  className={`line-clamp-1 shrink-0 font-semibold text-slate-800 dark:text-slate-100 ${
                    compactCards ? "text-[10px] leading-tight" : "text-xs lg:text-sm"
                  }`}
                >
                  {book.ebook_name}
                </p>
                {!compactCards ? (
                  <p className="mt-0.5 line-clamp-1 shrink-0 text-[11px] text-slate-500 dark:text-slate-400">
                    {book.author_name || "Unknown author"}
                  </p>
                ) : null}
                <Button
                  type="button"
                  className={`w-full shrink-0 justify-center rounded-md ${
                    compactCards
                      ? "mt-1 px-1 py-1 text-[10px] leading-none"
                      : "mt-1.5 rounded-lg px-2 py-1.5 text-xs"
                  }`}
                  onClick={() => goToDetail(book.ebook_id)}
                >
                  See Detail
                </Button>
              </motion.div>
            ))}
          </div>
          <TablePagination
            className="mt-0 shrink-0 !py-2"
            page={page}
            limit={limit}
            total={totalFiltered}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            onPageChange={(nextPage) => updateListParams({ page: nextPage })}
            onLimitChange={(val) => updateListParams({ limit: val, page: 1 })}
          />
        </div>
      ) : (
        <div className="min-h-0 flex-1 space-y-3 overflow-auto">
          <Table<EbookRow> columns={columns} data={tableRows} emptyMessage={emptyMessage} />
          <TablePagination
            className="mt-0"
            page={page}
            limit={limit}
            total={totalFiltered}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            onPageChange={(nextPage) => updateListParams({ page: nextPage })}
            onLimitChange={(val) => updateListParams({ limit: val, page: 1 })}
          />
        </div>
      )}
    </div>
  );
};

export default MemberDigitalCatalog;
