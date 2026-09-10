import { Eye, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Input from "../../components/ui/Input";
import TablePagination from "../../components/ui/TablePagination";
import { Table } from "../../components/ui/Table";
import PageHeader from "../../components/ui/PageHeader";
import { useTimezone } from "../../context/TimezoneContext";
import { EbookItem, getApiErrorMessage, getEbooksPage } from "../../services/api";

type ImportRow = Record<string, unknown> & {
  id: number;
  title: string;
  author_name: string;
  category_name: string;
  doi: string;
  year: string;
  imported_at: string;
};

function parseDoi(description: string): string {
  const match = description.match(/DOI:\s*(\S+)/i);
  return match ? match[1].replace(/[.,;]+$/, "") : "—";
}

const PAGE_SIZE = 25;

const ImportedPapers = () => {
  const navigate = useNavigate();
  const { formatDateTime, formatTime } = useTimezone();
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 350);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ]);

  const load = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setLoading(true);
        setError("");
        const result = await getEbooksPage({
          page,
          limit: PAGE_SIZE,
          q: debouncedQ || undefined,
          imported: true
        });
        setRows(
          result.items.map((item: EbookItem) => ({
            id: item.ebook_id,
            title: item.ebook_name,
            author_name: item.author_name || "—",
            category_name: item.category_name || "—",
            doi: parseDoi(item.description),
            year: item.release_date ? item.release_date.slice(0, 4) : "—",
            imported_at: formatDateTime(item.created_at)
          }))
        );
        setTotal(result.total);
        setUpdatedAt(new Date());
      } catch (err) {
        setError(getApiErrorMessage(err));
      } finally {
        setLoading(false);
      }
    },
    [formatDateTime, page, debouncedQ]
  );

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 15000);
    return () => window.clearInterval(timer);
  }, [load]);

  const columns = [
    {
      key: "title" as const,
      title: "Paper",
      render: (row: ImportRow) => (
        <div className="max-w-xl">
          <p className="font-semibold text-slate-800 dark:text-white">{row.title}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{row.doi}</p>
        </div>
      )
    },
    { key: "author_name" as const, title: "Author" },
    { key: "category_name" as const, title: "Category" },
    { key: "year" as const, title: "Year" },
    { key: "imported_at" as const, title: "Imported" },
    {
      key: "id" as const,
      title: "Actions",
      render: (row: ImportRow) => (
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          title="View"
          onClick={() => navigate(`/admin/ebooks/${row.id}`)}
        >
          <Eye className="h-4 w-4" />
        </button>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Imported Papers"
        description="Research papers synced into the e-book catalog."
        actions={
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        }
      />

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-200">
          {error}
        </div>
      )}

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search imported papers…"
          className="pl-10"
          aria-label="Search imported papers"
        />
      </div>

      <p className="text-sm text-slate-500 dark:text-slate-400">
        {total.toLocaleString()} papers
        {updatedAt ? ` · updated ${formatTime(updatedAt.toISOString())}` : ""}
      </p>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800">
          Loading imported papers…
        </div>
      ) : (
        <>
          <Table<ImportRow>
            columns={columns}
            data={rows}
            emptyMessage="No imported papers found."
          />
          {total > 0 && (
            <TablePagination
              page={page}
              limit={PAGE_SIZE}
              total={total}
              onPageChange={setPage}
              onLimitChange={() => undefined}
            />
          )}
        </>
      )}
    </div>
  );
};

export default ImportedPapers;
