import { motion } from "framer-motion";
import { Eye, LayoutGrid, List, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import PageHeader from "../../components/ui/PageHeader";
import TablePagination from "../../components/ui/TablePagination";
import { Table } from "../../components/ui/Table";
import {
  BookItem,
  CategoryOption,
  getApiErrorMessage,
  getBooksPage,
  getCategories
} from "../../services/api";

type Toast = { kind: "success" | "error"; message: string } | null;

type BookRow = Record<string, unknown> & {
  id: number;
  book_name: string;
  cover_image: string;
  author_name: string;
  category_name: string;
  place: string;
  status: "available" | "unavailable";
  release_date: string;
  description: string;
};

type ViewMode = "grid" | "list";

const FALLBACK_COVER = "/sidebar-admin-icon.png";
/**
 * Desktop: 6 columns. Card size always matches the default 12 view (2 rows on screen).
 * 12 = one screen; 24 / 36 = same card size, extra rows via scroll.
 */
const DEFAULT_LIMIT = 12;
const PAGE_SIZE_OPTIONS = [12, 24, 36];
const GRID_CLASS =
  "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 lg:gap-2.5 lg:auto-rows-[calc((100cqh-0.625rem)/2)]";
const CARD_CLASS =
  "relative flex h-full min-h-0 flex-col items-stretch rounded-xl border border-slate-200/60 bg-white/70 p-2 shadow-md backdrop-blur-md transition hover:shadow-lg dark:border-slate-700 dark:bg-slate-800/70";
const COVER_SHELL_CLASS =
  "mb-1.5 flex min-h-0 flex-1 items-center justify-center overflow-hidden";
const COVER_FRAME_CLASS =
  "aspect-[3/4] w-full max-h-full overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-700/70 lg:h-full lg:w-auto lg:max-w-full";

function mapBook(b: BookItem): BookRow {
  return {
    id: b.book_id,
    book_name: b.book_name,
    cover_image: b.cover_image ?? "",
    author_name: b.author_name || `Author #${b.author_id}`,
    category_name: b.category_name || `Category #${b.category_id}`,
    place: b.place || "",
    status: b.available ? "available" : "unavailable",
    release_date: b.release_date ?? "-",
    description: b.description ?? ""
  };
}

const Books = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<BookRow[]>([]);
  const [categories, setCategories] = useState<string[]>(["All Categories"]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All Categories");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [total, setTotal] = useState(0);
  const [toast, setToast] = useState<Toast>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 350);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, selectedCategory, limit]);

  useEffect(() => {
    let cancelled = false;
    const loadCategories = async () => {
      try {
        const cats = await getCategories({ counts: true });
        if (cancelled) return;
        const names = cats
          .filter((c: CategoryOption) => (c.book_count ?? 0) > 0)
          .map((c: CategoryOption) => c.category_name)
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b));
        setCategories(["All Categories", ...names]);
      } catch {
        // Keep All Categories only.
      }
    };
    void loadCategories();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const result = await getBooksPage({
          page,
          limit,
          q: debouncedQ || undefined,
          category: selectedCategory === "All Categories" ? undefined : selectedCategory,
          sortBy: "bookId",
          sortDir: "desc"
        });
        if (cancelled) return;
        setRows(result.items.map(mapBook));
        setTotal(result.total);
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
  }, [page, limit, debouncedQ, selectedCategory]);

  const totalPages = useMemo(
    () => (total === 0 ? 1 : Math.ceil(total / limit)),
    [total, limit]
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const columns = [
    { key: "book_name" as const, title: "Book Name" },
    {
      key: "cover_image" as const,
      title: "Cover",
      render: (row: BookRow) => (
        <div className="h-16 w-12 overflow-hidden rounded-md border border-slate-200 bg-slate-100 dark:border-slate-600 dark:bg-slate-700">
          <img
            src={row.cover_image || FALLBACK_COVER}
            alt={row.book_name}
            loading="lazy"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = FALLBACK_COVER;
            }}
            className="h-full w-full object-cover"
          />
        </div>
      )
    },
    { key: "author_name" as const, title: "Author" },
    { key: "category_name" as const, title: "Category" },
    { key: "place" as const, title: "Place", render: (row: BookRow) => row.place || "-" },
    {
      key: "status" as const,
      title: "Status",
      render: (row: BookRow) => (
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
            row.status === "available"
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
              : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
          }`}
        >
          {row.status === "available" ? "Available" : "Unavailable"}
        </span>
      )
    },
    { key: "release_date" as const, title: "Release Date" },
    {
      key: "description" as const,
      title: "Description",
      render: (row: BookRow) => (
        <div className="max-w-[220px]">
          <span className="block truncate" title={row.description || "-"}>
            {row.description || "-"}
          </span>
        </div>
      )
    },
    {
      key: "id" as const,
      title: "Actions",
      render: (row: BookRow) => (
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          title="View"
          onClick={() => navigate(`/member/books/${row.id}`)}
        >
          <Eye className="h-4 w-4" />
        </button>
      )
    }
  ];

  const BookCard = ({ row }: { row: BookRow }) => (
    <motion.div initial={false} animate={{ opacity: 1, y: 0 }} className={CARD_CLASS}>
      <div className={COVER_SHELL_CLASS}>
        <div className={COVER_FRAME_CLASS}>
          <img
            src={row.cover_image || FALLBACK_COVER}
            alt={row.book_name}
            loading="lazy"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = FALLBACK_COVER;
            }}
            className="h-full w-full object-cover"
          />
        </div>
      </div>
      <h3 className="line-clamp-1 w-full shrink-0 text-center text-xs font-semibold text-slate-800 dark:text-white lg:text-sm">
        {row.book_name}
      </h3>
      <p className="mt-0.5 line-clamp-1 w-full shrink-0 text-center text-[11px] text-slate-500 dark:text-slate-400">
        {row.author_name || "Unknown author"}
      </p>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-1">
        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-200">
          {row.category_name || "Uncategorized"}
        </span>
        <span
          className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
            row.status === "available"
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
              : "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
          }`}
        >
          {row.status === "available" ? "Available" : "Unavailable"}
        </span>
      </div>
      <p className="mt-1 line-clamp-1 w-full shrink-0 text-center text-[10px] text-slate-500 dark:text-slate-400">
        {row.place || "Place not set"}
      </p>
      <Button
        type="button"
        className="mt-1.5 w-full shrink-0 justify-center rounded-lg px-2 py-1.5 text-xs"
        onClick={() => navigate(`/member/books/${row.id}`)}
      >
        View Details
      </Button>
    </motion.div>
  );

  return (
    <div className="flex min-h-0 flex-col gap-3 lg:h-[calc(100dvh-9rem)] lg:overflow-hidden lg:gap-2.5">
      <div className="shrink-0 space-y-3 lg:space-y-2">
        <PageHeader
          title="Books"
          description="Browse books in the library catalog."
          actions={
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              aria-label="Filter by category"
            >
              {categories.map((cat) => (
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
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by book, author or category..."
              className="pl-10"
              aria-label="Search books"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                viewMode === "grid"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
              onClick={() => setViewMode("grid")}
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
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
              List
            </button>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {total.toLocaleString()} books
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="min-h-0 flex-1 overflow-y-auto [container-type:size]">
          <div className={GRID_CLASS}>
            {Array.from({ length: Math.min(limit, DEFAULT_LIMIT) }, (_, i) => i).map((n) => (
              <div key={n} className={`${CARD_CLASS} animate-pulse`}>
                <div className={COVER_SHELL_CLASS}>
                  <div className={`${COVER_FRAME_CLASS} bg-slate-200 dark:bg-slate-700`} />
                </div>
                <div className="mx-auto h-3 w-4/5 rounded bg-slate-200 dark:bg-slate-700" />
                <div className="mt-1.5 h-8 w-full rounded-lg bg-slate-200 dark:bg-slate-700" />
              </div>
            ))}
          </div>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/60 bg-white/70 p-8 text-center text-sm text-slate-500 shadow-lg backdrop-blur-md dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300">
          No books found in this category.
        </div>
      ) : viewMode === "grid" ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <div className="min-h-0 flex-1 overflow-y-auto [container-type:size]">
            <div className={GRID_CLASS}>
              {rows.map((row) => (
                <BookCard key={row.id} row={row} />
              ))}
            </div>
          </div>
          <TablePagination
            className="mt-0 shrink-0 !py-2"
            page={page}
            limit={limit}
            total={total}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            onPageChange={setPage}
            onLimitChange={(val) => {
              setLimit(PAGE_SIZE_OPTIONS.includes(val) ? val : DEFAULT_LIMIT);
              setPage(1);
            }}
          />
        </div>
      ) : (
        <div className="min-h-0 flex-1 space-y-3 overflow-auto">
          <Table<BookRow> columns={columns} data={rows} emptyMessage="No books found in this category." />
          <TablePagination
            className="mt-0"
            page={page}
            limit={limit}
            total={total}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            onPageChange={setPage}
            onLimitChange={(val) => {
              setLimit(PAGE_SIZE_OPTIONS.includes(val) ? val : DEFAULT_LIMIT);
              setPage(1);
            }}
          />
        </div>
      )}
    </div>
  );
};

export default Books;
