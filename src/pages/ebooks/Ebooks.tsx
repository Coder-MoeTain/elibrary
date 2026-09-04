import { motion } from "framer-motion";
import { ChevronDown, Eye, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../components/ui/Button";
import DatePicker from "../../components/ui/DatePicker";
import FileUpload from "../../components/ui/FileUpload";
import Input from "../../components/ui/Input";
import Modal from "../../components/ui/Modal";
import SearchableSelect from "../../components/ui/SearchableSelect";
import AdminTableToolbar from "../../components/ui/AdminTableToolbar";
import TableInfiniteFooter from "../../components/ui/TableInfiniteFooter";
import TablePagination from "../../components/ui/TablePagination";
import { Table } from "../../components/ui/Table";
import PageHeader from "../../components/ui/PageHeader";
import { useAdminTableInfiniteScroll } from "../../components/ui/useAdminTableInfiniteScroll";
import { ADMIN_TABLE_DISPLAY_MODE } from "../../config/adminTableMode";
import Tooltip from "../../components/ui/Tooltip";
import { isSuperAdmin, SUPER_ADMIN_ONLY_TOOLTIP } from "../../utils/auth";
import { sortRows } from "../../utils/tableSort";
import {
  AuthorOption,
  CategoryOption,
  createEbook,
  deleteEbook,
  EbookItem,
  EbookPayload,
  EbookSummaryStatus,
  getApiErrorMessage,
  getAuthors,
  getCategories,
  getEbooks,
  updateEbook
} from "../../services/api";

type EbookRow = Record<string, unknown> & {
  id: number;
  ebook_name: string;
  author_name: string;
  category_name: string;
  status: EbookSummaryStatus;
  release_date: string;
  description: string;
  cover_image: string;
  pdf_file: string;
  author_id: number;
  category_id: number;
};

type Toast = { kind: "success" | "error"; message: string } | null;
type StatusFilterValue = "all" | EbookSummaryStatus;

const STATUS_FILTER_OPTIONS: { value: Exclude<StatusFilterValue, "all">; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" }
];

const STATUS_LABEL: Record<EbookSummaryStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed"
};

const STATUS_BADGE_CLASS: Record<EbookSummaryStatus, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  processing: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  failed: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
};

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

const Ebooks = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<EbookRow[]>([]);
  const [authors, setAuthors] = useState<AuthorOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("all");
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const statusHeaderRef = useRef<HTMLDivElement>(null);
  const [openForm, setOpenForm] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selected, setSelected] = useState<EbookRow | null>(null);
  const [form, setForm] = useState<EbookPayload>(emptyForm);
  const [toast, setToast] = useState<Toast>(null);
  const [authorQuery, setAuthorQuery] = useState("");
  const [categoryQuery, setCategoryQuery] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const hydrateRows = (list: EbookItem[]): EbookRow[] =>
    list.map((b) => ({
      id: b.ebook_id,
      ebook_name: b.ebook_name,
      author_name: b.author_name || `Author #${b.author_id}`,
      category_name: b.category_name || `Category #${b.category_id}`,
      status: b.summary_status,
      release_date: b.release_date ?? "-",
      description: b.description ?? "",
      cover_image: b.cover_image ?? "",
      pdf_file: b.pdf_file ?? "",
      author_id: b.author_id,
      category_id: b.category_id
    }));

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [ebookRows, authorRows, categoryRows] = await Promise.all([
        getEbooks(),
        getAuthors(),
        getCategories()
      ]);
      setRows(hydrateRows(ebookRows));
      setAuthors(authorRows);
      setCategories(categoryRows);
    } catch (err) {
      setToast({ kind: "error", message: getApiErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAll();
  }, []);

  useEffect(() => {
    if (!statusMenuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!statusHeaderRef.current?.contains(e.target as Node)) {
        setStatusMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [statusMenuOpen]);

  const filtered = useMemo(() => {
    let next = rows;
    if (statusFilter !== "all") {
      next = next.filter((r) => r.status === statusFilter);
    }
    const s = q.trim().toLowerCase();
    if (!s) return next;
    return next.filter(
      (r) =>
        String(r.ebook_name).toLowerCase().includes(s) ||
        String(r.author_name).toLowerCase().includes(s) ||
        String(r.category_name).toLowerCase().includes(s) ||
        STATUS_LABEL[r.status].toLowerCase().includes(s)
    );
  }, [rows, q, statusFilter]);

  const filterResetKey = `${q}|${statusFilter}`;

  useEffect(() => {
    setPage(1);
  }, [q, statusFilter]);

  const sortedFiltered = useMemo(
    () => sortRows(filtered, sortKey, sortOrder),
    [filtered, sortKey, sortOrder],
  );

  const totalSorted = sortedFiltered.length;

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * limit;
    return sortedFiltered.slice(start, start + limit);
  }, [sortedFiltered, page, limit]);

  const infiniteScroll = useAdminTableInfiniteScroll(sortedFiltered, filterResetKey, {
    step: limit,
  });

  useEffect(() => {
    const tp = totalSorted === 0 ? 1 : Math.ceil(totalSorted / limit);
    if (page > tp) setPage(tp);
  }, [totalSorted, limit, page]);

  const onSortClick = (key: string) => {
    if (sortKey === key) setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  const statusHeaderMenu = (
    <div ref={statusHeaderRef} className="relative inline-block text-left">
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-lg px-1 py-0.5 font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-primary dark:text-slate-300 dark:hover:bg-slate-700/80 dark:hover:text-white"
        onClick={() => setStatusMenuOpen((o) => !o)}
        aria-expanded={statusMenuOpen}
        aria-haspopup="listbox"
        aria-label="Filter by status"
      >
        Status
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 opacity-70 transition-transform ${statusMenuOpen ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {statusMenuOpen && (
        <div
          className="absolute left-0 top-full z-[130] mt-1 min-w-[10rem] rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-800"
          role="listbox"
        >
          {STATUS_FILTER_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="option"
              aria-selected={statusFilter === value}
              className={`flex w-full items-center px-3 py-2 text-left text-sm transition hover:bg-slate-50 dark:hover:bg-slate-700/80 ${
                statusFilter === value
                  ? "bg-slate-50 font-semibold text-primary dark:bg-slate-700/50 dark:text-white"
                  : "text-slate-700 dark:text-slate-200"
              }`}
              onClick={() => {
                setStatusFilter(value);
                setStatusMenuOpen(false);
              }}
            >
              {label}
            </button>
          ))}
          {statusFilter !== "all" && (
            <div className="mt-1 border-t border-slate-100 pt-1 dark:border-slate-600">
              <button
                type="button"
                className="w-full px-3 py-1.5 text-left text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700/80 dark:hover:text-slate-200"
                onClick={() => {
                  setStatusFilter("all");
                  setStatusMenuOpen(false);
                }}
              >
                View all e-books
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const tableRows =
    ADMIN_TABLE_DISPLAY_MODE === "infinite"
      ? infiniteScroll.visibleSlice
      : paginatedRows;

  const rowNumberBase =
    ADMIN_TABLE_DISPLAY_MODE === "infinite" ? 0 : (page - 1) * limit;

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setAuthorQuery("");
    setCategoryQuery("");
  };

  const startCreate = () => {
    resetForm();
    setOpenForm(true);
  };

  const startEdit = (row: EbookRow) => {
    setForm({
      ebook_name: row.ebook_name,
      author_id: row.author_id,
      author_name: "",
      category_id: row.category_id,
      category_name: "",
      release_date: row.release_date === "-" ? "" : row.release_date,
      description: row.description,
      cover_file: null,
      pdf_file: null,
      cover_image: row.cover_image,
      pdf_url: row.pdf_file
    });
    setAuthorQuery(row.author_name || "");
    setCategoryQuery(row.category_name || "");
    setEditingId(row.id);
    setOpenForm(true);
  };

  const startDelete = (row: EbookRow) => {
    setSelected(row);
    setOpenDelete(true);
  };

  const goToEbookDetail = (row: EbookRow) => {
    navigate(`/admin/ebooks/${row.id}`);
  };

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();

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
    try {
      setSaving(true);
      if (editingId) {
        await updateEbook(editingId, payload);
        setToast({ kind: "success", message: "e-Book updated successfully." });
      } else {
        await createEbook(payload);
        setToast({ kind: "success", message: "e-Book created successfully." });
      }
      setOpenForm(false);
      resetForm();
      await fetchAll();
    } catch (err) {
      setToast({ kind: "error", message: getApiErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!selected) return;
    try {
      setSaving(true);
      await deleteEbook(selected.id);
      setToast({ kind: "success", message: "e-Book deleted successfully." });
      setOpenDelete(false);
      setSelected(null);
      await fetchAll();
    } catch (err) {
      setToast({ kind: "error", message: getApiErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: "ebook_name" as const, title: "Title", sortable: true },
    {
      key: "cover_image" as const,
      title: "Cover",
      render: (row: EbookRow) => (
        <div className="h-16 w-12 overflow-hidden rounded-md border border-slate-200 bg-slate-100 dark:border-slate-600 dark:bg-slate-700">
          {row.cover_image ? (
            <img
              src={row.cover_image}
              alt={row.ebook_name}
              loading="lazy"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[10px] font-semibold text-slate-400">
              No Cover
            </div>
          )}
        </div>
      )
    },
    { key: "author_name" as const, title: "Author", sortable: true },
    { key: "category_name" as const, title: "Category", sortable: true },
    {
      key: "status" as const,
      title: "Status",
      sortable: true,
      headerCell: statusHeaderMenu,
      render: (row: EbookRow) => (
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_BADGE_CLASS[row.status]}`}
        >
          {STATUS_LABEL[row.status]}
        </span>
      )
    },
    {
      key: "description" as const,
      title: "Description",
      sortable: true,
      render: (row: EbookRow) => (
        <div className="max-w-[220px]">
          <span className="block truncate" title={row.description || "-"}>
            {row.description || "-"}
          </span>
          {row.description && row.description.length > 60 && (
            <button
              type="button"
              className="mt-1 text-xs font-semibold text-primary hover:underline"
              onClick={() => goToEbookDetail(row)}
            >
              Read more
            </button>
          )}
        </div>
      )
    },
    {
      key: "id" as const,
      title: "Actions",
      render: (row: EbookRow) => (
        <div className="flex flex-wrap gap-1">
          <button type="button" className={actionClass} title="View" onClick={() => goToEbookDetail(row)}>
            <Eye className="h-4 w-4" />
          </button>
          <button type="button" className={actionClass} title="Edit" onClick={() => startEdit(row)}>
            <Pencil className="h-4 w-4" />
          </button>
          <Tooltip text={!isSuperAdmin() ? SUPER_ADMIN_ONLY_TOOLTIP : "Delete e-book"}>
            <span className="inline-flex">
              <button
                type="button"
                className={`${actionClass} ${!isSuperAdmin() ? "cursor-not-allowed opacity-45" : ""}`}
                title="Delete"
                disabled={!isSuperAdmin()}
                onClick={() => isSuperAdmin() && startDelete(row)}
              >
                <Trash2 className="h-4 w-4 text-rose-500" />
              </button>
            </span>
          </Tooltip>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="e-Books Management"
        actions={
          <Button type="button" className="inline-flex items-center gap-2" onClick={startCreate}>
            <Plus className="h-4 w-4" />
            Add e-Book
          </Button>
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

      <AdminTableToolbar>
        <div className="relative min-w-[12rem] max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search e-books…"
            className="pl-10"
            aria-label="Search e-books"
          />
        </div>
      </AdminTableToolbar>

      <motion.div initial={false} animate={{ opacity: 1 }} transition={{ delay: 0.02 }}>
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            Loading e-books...
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            No e-books found.
          </div>
        ) : (
          <>
            <Table<EbookRow>
              columns={columns}
              data={tableRows}
              sortKey={sortKey}
              sortOrder={sortOrder}
              onSortClick={onSortClick}
              rowNumberBase={rowNumberBase}
            />
            {ADMIN_TABLE_DISPLAY_MODE === "pagination" ? (
              <TablePagination
                page={page}
                limit={limit}
                total={totalSorted}
                onPageChange={setPage}
                onLimitChange={(val) => {
                  setLimit(val);
                  setPage(1);
                }}
              />
            ) : (
              <TableInfiniteFooter
                sentinelRef={infiniteScroll.sentinelRef}
                hasMore={infiniteScroll.hasMore}
              />
            )}
          </>
        )}
      </motion.div>

      <Modal open={openForm} title={editingId ? "Edit e-Book" : "Add e-Book"} onClose={() => setOpenForm(false)}>
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
          <FileUpload
            label="Upload Cover Image"
            accept="image/*"
            fileName={form.cover_file?.name || form.cover_image?.split("/").pop() || ""}
            onFileChange={(file) => setForm((p) => ({ ...p, cover_file: file }))}
          />
          <FileUpload
            label="Upload PDF"
            accept="application/pdf"
            fileName={form.pdf_file?.name || form.pdf_url?.split("/").pop() || ""}
            onFileChange={(file) => setForm((p) => ({ ...p, pdf_file: file }))}
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

      <Modal open={openDelete} title="Delete e-Book" onClose={() => setOpenDelete(false)}>
        <div className="space-y-4">
          <p className="text-sm text-slate-700 dark:text-slate-200">
            Are you sure you want to delete <span className="font-semibold">{selected?.ebook_name}</span>?
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpenDelete(false)}>
              Cancel
            </Button>
            <Button type="button" variant="danger" onClick={onDelete} disabled={saving}>
              {saving ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default Ebooks;
