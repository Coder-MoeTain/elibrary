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
const skeletonCards = Array.from({ length: 10 }, (_, i) => i);
const PAGE_SIZE = 24;

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
  const [total, setTotal] = useState(0);
  const [toast, setToast] = useState<Toast>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 350);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, selectedCategory]);

  useEffect(() => {
    let cancelled = false;
    const loadCategories = async () => {
      try {
        const cats = await getCategories();
        if (cancelled) return;
        const names = cats
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
          limit: PAGE_SIZE,
          q: debouncedQ || undefined,
          category:
            selectedCategory === "All Categories" ? undefined : selectedCategory
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
  }, [page, debouncedQ, selectedCategory]);

  const totalPages = useMemo(
    () => (total === 0 ? 1 : Math.ceil(total / PAGE_SIZE)),
    [total]
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
    <motion.div
      layout
      initial={false}
      whileHover={{ y: -4 }}
      className="rounded-2xl border border-slate-200/70 bg-white/80 p-3 shadow-sm transition hover:shadow-lg dark:border-slate-700 dark:bg-slate-800/70"
    >
      <div className="mb-3 aspect-[3/4] overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-900">
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
      <h3 className="line-clamp-2 text-sm font-semibold text-slate-800 dark:text-white">{row.book_name}</h3>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{row.author_name || "Unknown author"}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-200">
          {row.category_name || "Uncategorized"}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            row.status === "available"
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
              : "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
          }`}
        >
          {row.status === "available" ? "Available" : "Unavailable"}
        </span>
      </div>
      <p className="mt-2 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">{row.place || "Place not set"}</p>
      <Button type="button" className="mt-3 w-full justify-center" onClick={() => navigate(`/member/books/${row.id}`)}>
        View Details
      </Button>
    </motion.div>
  );

  return (
    <div className="space-y-6">
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

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by book, author or category..."
          className="pl-10"
          aria-label="Search books"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
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
        </div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          {total.toLocaleString()} books
        </p>
      </div>

      <motion.div initial={false} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}>
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {skeletonCards.map((n) => (
              <div
                key={n}
                className="animate-pulse rounded-2xl border border-slate-200/60 bg-white/80 p-3 dark:border-slate-700 dark:bg-slate-800/70"
              >
                <div className="mb-3 aspect-[3/4] rounded-xl bg-slate-200 dark:bg-slate-700" />
                <div className="h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-700" />
                <div className="mt-2 h-3 w-1/2 rounded bg-slate-200 dark:bg-slate-700" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-slate-200/60 bg-white/70 p-8 text-center text-sm text-slate-500 shadow-lg backdrop-blur-md dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300">
            No books found in this category.
          </div>
        ) : viewMode === "grid" ? (
          <motion.div
            layout
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5"
          >
            {rows.map((row) => (
              <BookCard key={row.id} row={row} />
            ))}
          </motion.div>
        ) : (
          <Table<BookRow> columns={columns} data={rows} emptyMessage="No books found in this category." />
        )}
      </motion.div>

      {!loading && total > 0 && (
        <TablePagination
          page={page}
          limit={PAGE_SIZE}
          total={total}
          onPageChange={setPage}
          onLimitChange={() => undefined}
        />
      )}
    </div>
  );
};

export default Books;
