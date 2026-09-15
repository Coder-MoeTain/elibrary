import { Eye, Pencil, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Button from "../../components/ui/Button";
import DatePicker from "../../components/ui/DatePicker";
import Input from "../../components/ui/Input";
import Modal from "../../components/ui/Modal";
import SearchableSelect from "../../components/ui/SearchableSelect";
import TablePagination from "../../components/ui/TablePagination";
import { Table } from "../../components/ui/Table";
import PageHeader from "../../components/ui/PageHeader";
import { useTimezone } from "../../context/TimezoneContext";
import {
  ADMIN_CATALOG_LIST_RETURN_KEY,
  ADMIN_IMPORTS_LIST_RETURN_KEY,
  buildQueryString,
  parsePositiveInt
} from "../../utils/adminListReturn";
import {
  AuthorOption,
  CategoryOption,
  EbookItem,
  EbookPayload,
  getApiErrorMessage,
  getAuthors,
  getCategories,
  getEbooksPage,
  updateEbook
} from "../../services/api";

type ImportRow = Record<string, unknown> & {
  id: number;
  title: string;
  author_name: string;
  category_name: string;
  doi: string;
  year: string;
  imported_at: string;
  author_id: number;
  category_id: number;
  description: string;
  release_date: string;
};

type Toast = { kind: "success" | "error"; message: string } | null;

const actionClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700";

const emptyForm: EbookPayload = {
  ebook_name: "",
  author_id: 0,
  author_name: "",
  category_id: 0,
  category_name: "",
  release_date: "",
  description: "",
  cover_file: null,
  pdf_file: null,
  cover_image: "",
  pdf_url: ""
};

function parseDoi(description: string): string {
  const match = description.match(/DOI:\s*(\S+)/i);
  return match ? match[1].replace(/[.,;]+$/, "") : "—";
}

const PAGE_SIZE = 25;

const ImportedPapers = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { formatDateTime, formatTime } = useTimezone();
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [authors, setAuthors] = useState<AuthorOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const page = parsePositiveInt(searchParams.get("page"), 1);
  const qFromUrl = searchParams.get("q") ?? "";
  const [q, setQ] = useState(qFromUrl);
  const [debouncedQ, setDebouncedQ] = useState(qFromUrl);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<Toast>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [openForm, setOpenForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<EbookPayload>(emptyForm);
  const [authorQuery, setAuthorQuery] = useState("");
  const [categoryQuery, setCategoryQuery] = useState("");
  const skipFilterResetRef = useRef(true);

  const buildImportsListSearch = (overrides?: { page?: number; q?: string }) =>
    buildQueryString({
      page: (overrides?.page ?? page) > 1 ? overrides?.page ?? page : undefined,
      q: (overrides?.q ?? debouncedQ) || undefined
    });

  const updateListParams = (overrides: { page?: number; q?: string }) => {
    const next = new URLSearchParams();
    const nextPage = overrides.page ?? page;
    const nextQ = overrides.q !== undefined ? overrides.q : debouncedQ;
    if (nextPage > 1) next.set("page", String(nextPage));
    if (nextQ.trim()) next.set("q", nextQ.trim());
    setSearchParams(next, { replace: true });
  };

  const goToDetail = (row: ImportRow) => {
    const returnTo = `/admin/imports${buildImportsListSearch()}`;
    sessionStorage.setItem(ADMIN_IMPORTS_LIST_RETURN_KEY, returnTo);
    sessionStorage.setItem(ADMIN_CATALOG_LIST_RETURN_KEY, returnTo);
    navigate(`/admin/ebooks/${row.id}`, { state: { listReturnTo: returnTo } });
  };

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 350);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (qFromUrl !== debouncedQ && qFromUrl !== q) {
      setQ(qFromUrl);
      setDebouncedQ(qFromUrl);
    }
  }, [qFromUrl]);

  useEffect(() => {
    if (skipFilterResetRef.current) {
      skipFilterResetRef.current = false;
      return;
    }
    if (page !== 1) updateListParams({ page: 1, q: debouncedQ });
    else if ((searchParams.get("q") ?? "") !== debouncedQ) {
      updateListParams({ page: 1, q: debouncedQ });
    }
  }, [debouncedQ]);

  useEffect(() => {
    void getAuthors()
      .then(setAuthors)
      .catch((err) => setToast({ kind: "error", message: getApiErrorMessage(err) }));
    void getCategories()
      .then(setCategories)
      .catch((err) => setToast({ kind: "error", message: getApiErrorMessage(err) }));
  }, []);

  const load = useCallback(
    async (opts?: { silent?: boolean; targetPage?: number }) => {
      const silent = opts?.silent ?? false;
      const targetPage = opts?.targetPage ?? page;
      try {
        if (!silent) setLoading(true);
        setError("");
        const result = await getEbooksPage({
          page: targetPage,
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
            imported_at: formatDateTime(item.created_at),
            author_id: item.author_id,
            category_id: item.category_id,
            description: item.description ?? "",
            release_date: item.release_date ?? ""
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
    const timer = window.setInterval(() => void load({ silent: true }), 15000);
    return () => window.clearInterval(timer);
  }, [load]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setAuthorQuery("");
    setCategoryQuery("");
  };

  const startEdit = (row: ImportRow) => {
    setForm({
      ebook_name: row.title,
      author_id: row.author_id,
      author_name: "",
      category_id: row.category_id,
      category_name: "",
      release_date: row.release_date,
      description: row.description,
      cover_file: null,
      pdf_file: null,
      cover_image: "",
      pdf_url: ""
    });
    setAuthorQuery(row.author_name === "—" ? "" : row.author_name);
    setCategoryQuery(row.category_name === "—" ? "" : row.category_name);
    setEditingId(row.id);
    setOpenForm(true);
  };

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;

    const trimmedAuthor = (form.author_name || authorQuery).trim();
    const matchedAuthor = authors.find(
      (a) => a.author_name.toLowerCase() === trimmedAuthor.toLowerCase()
    );
    const author_id = matchedAuthor
      ? matchedAuthor.author_id
      : trimmedAuthor
        ? undefined
        : form.author_id || undefined;
    const author_name = matchedAuthor ? undefined : trimmedAuthor || undefined;

    const trimmedCategory = (form.category_name || categoryQuery).trim();
    const matchedCategory = categories.find(
      (c) => c.category_name.toLowerCase() === trimmedCategory.toLowerCase()
    );
    const category_id = matchedCategory
      ? matchedCategory.category_id
      : trimmedCategory
        ? undefined
        : form.category_id || undefined;
    const category_name = matchedCategory ? undefined : trimmedCategory || undefined;

    const payload: EbookPayload = {
      ...form,
      author_id,
      author_name,
      category_id,
      category_name
    };
    if ((!payload.author_id && !payload.author_name) || (!payload.category_id && !payload.category_name)) {
      setToast({ kind: "error", message: "Please select or add author and category." });
      return;
    }

    const currentPage = page;
    try {
      setSaving(true);
      await updateEbook(editingId, payload);
      setToast({ kind: "success", message: "Imported paper updated successfully." });
      setOpenForm(false);
      resetForm();
      await load({ targetPage: currentPage });
    } catch (err) {
      setToast({ kind: "error", message: getApiErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

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
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            className={actionClass}
            title="View"
            onClick={() => goToDetail(row)}
          >
            <Eye className="h-4 w-4" />
          </button>
          <button type="button" className={actionClass} title="Edit" onClick={() => startEdit(row)}>
            <Pencil className="h-4 w-4" />
          </button>
        </div>
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

      {toast && (
        <div
          className={`rounded-xl border px-3 py-2 text-sm ${
            toast.kind === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
              : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-200"
          }`}
        >
          {toast.message}
        </div>
      )}

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
              onPageChange={(next) => updateListParams({ page: next })}
              onLimitChange={() => undefined}
            />
          )}
        </>
      )}

      <Modal open={openForm} title="Edit imported paper" onClose={() => setOpenForm(false)}>
        <form className="space-y-3" onSubmit={onSave}>
          <Input
            name="ebook_name"
            placeholder="Title"
            value={form.ebook_name}
            onChange={(e) => setForm((p) => ({ ...p, ebook_name: e.target.value }))}
            required
          />
          <SearchableSelect
            options={authors.map((a) => ({ value: a.author_id, label: a.author_name }))}
            value={form.author_id || 0}
            onValueChange={(value) =>
              setForm((p) => ({
                ...p,
                author_id: value,
                author_name: value ? "" : p.author_name
              }))
            }
            placeholder="Select author"
            onQueryChange={(query, exactMatch) => {
              setAuthorQuery(query);
              if (!exactMatch) {
                setForm((p) => ({ ...p, author_id: 0, author_name: query }));
              }
            }}
            createHint={
              authorQuery.trim() &&
              !authors.some((a) => a.author_name.toLowerCase() === authorQuery.trim().toLowerCase())
                ? `➕ Add '${authorQuery.trim()}'`
                : null
            }
            onCreateHintClick={() =>
              setForm((p) => ({
                ...p,
                author_id: 0,
                author_name: authorQuery.trim()
              }))
            }
          />
          <SearchableSelect
            options={categories.map((c) => ({ value: c.category_id, label: c.category_name }))}
            value={form.category_id || 0}
            onValueChange={(value) =>
              setForm((p) => ({
                ...p,
                category_id: value,
                category_name: value ? "" : p.category_name
              }))
            }
            placeholder="Select category"
            onQueryChange={(query, exactMatch) => {
              setCategoryQuery(query);
              if (!exactMatch) {
                setForm((p) => ({ ...p, category_id: 0, category_name: query }));
              }
            }}
            createHint={
              categoryQuery.trim() &&
              !categories.some((c) => c.category_name.toLowerCase() === categoryQuery.trim().toLowerCase())
                ? `➕ Add '${categoryQuery.trim()}'`
                : null
            }
            onCreateHintClick={() =>
              setForm((p) => ({
                ...p,
                category_id: 0,
                category_name: categoryQuery.trim()
              }))
            }
          />
          <DatePicker
            value={form.release_date}
            onChange={(date) => setForm((p) => ({ ...p, release_date: date }))}
            placeholder="Select release date"
          />
          <textarea
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            rows={3}
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpenForm(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ImportedPapers;
