import { motion } from "framer-motion";
import { Eye, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Input from "../../components/ui/Input";
import { Table } from "../../components/ui/Table";
import { EbookItem, getApiErrorMessage, getEbooks } from "../../services/api";

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

function formatWhen(raw: string): string {
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw.slice(0, 19).replace("T", " ");
  return d.toLocaleString();
}

const ImportedPapers = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError("");
      const items = await getEbooks({ imported: true });
      setRows(
        items.map((item: EbookItem) => ({
          id: item.ebook_id,
          title: item.ebook_name,
          author_name: item.author_name || "—",
          category_name: item.category_name || "—",
          doi: parseDoi(item.description),
          year: item.release_date ? item.release_date.slice(0, 4) : "—",
          imported_at: formatWhen(item.created_at)
        }))
      );
      setUpdatedAt(new Date());
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 15000);
    return () => window.clearInterval(timer);
  }, [load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      [row.title, row.author_name, row.category_name, row.doi].join(" ").toLowerCase().includes(needle)
    );
  }, [rows, q]);

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
          title="Open e-book"
          onClick={() => navigate(`/admin/ebooks/${row.id}`)}
        >
          <Eye className="h-4 w-4" />
        </button>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <motion.div initial={false} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Imported papers</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Research PDFs copied from pdf_downloader. This list refreshes automatically.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {updatedAt && (
            <span className="text-xs text-slate-400">Updated {updatedAt.toLocaleTimeString()}</span>
          )}
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            onClick={() => void load()}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </motion.div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search title, author, or DOI"
          className="pl-9"
        />
      </div>

      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </p>
      )}

      {loading && rows.length === 0 ? (
        <p className="text-sm text-slate-500">Loading imported papers…</p>
      ) : (
        <Table
          columns={columns}
          data={filtered}
          emptyMessage="No papers imported yet. Download an open-access PDF in pdf_downloader and it will appear here."
        />
      )}
    </div>
  );
};

export default ImportedPapers;
