import { motion } from "framer-motion";
import { ChevronDown, Eye, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Modal from "../../components/ui/Modal";
import DatePicker from "../../components/ui/DatePicker";
import SearchableSelect from "../../components/ui/SearchableSelect";
import FileUpload from "../../components/ui/FileUpload";
import AdminTableToolbar from "../../components/ui/AdminTableToolbar";
import TableInfiniteFooter from "../../components/ui/TableInfiniteFooter";
import TablePagination from "../../components/ui/TablePagination";
import { Table } from "../../components/ui/Table";
import { useAdminTableInfiniteScroll } from "../../components/ui/useAdminTableInfiniteScroll";
import { ADMIN_TABLE_DISPLAY_MODE } from "../../config/adminTableMode";
import Tooltip from "../../components/ui/Tooltip";
import { isSuperAdmin, SUPER_ADMIN_ONLY_TOOLTIP } from "../../utils/auth";
import { sortRows } from "../../utils/tableSort";
import {
  AuthorOption,
  BookItem,
  BookPayload,
  CategoryOption,
  createBook,
  deleteBook,
  getApiErrorMessage,
  getAuthors,
  getBooks,
  getCategories,
  getRentList,
  updateBook
} from "../../services/api";

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
  author_id: number;
  category_id: number;
};

type Toast = { kind: "success" | "error"; message: string } | null;
type StatusFilterValue = "all" | "available" | "unavailable";

const STATUS_FILTER_OPTIONS: { value: Exclude<StatusFilterValue, "all">; label: string }[] = [
  { value: "available", label: "Available" },
  { value: "unavailable", label: "Unavailable" }
];

const actionClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700";

const emptyForm: BookPayload = {
  book_name: "",
  author_id: 0,
  author_name: "",
  category_id: 0,
  category_name: "",
  release_date: "",
  description: "",
  cover_file: null,
  cover_image: "",
  place: ""
};

const Books = () => {
  const navigate = useNavigate();
  const [books, setBooks] = useState<BookRow[]>([]);
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
  const [selected, setSelected] = useState<BookRow | null>(null);
  const [form, setForm] = useState<BookPayload>(emptyForm);
  const [shelf, setShelf] = useState("");
  const [rowNumber, setRowNumber] = useState("");
  const [toast, setToast] = useState<Toast>(null);
  const [authorQuery, setAuthorQuery] = useState("");
  const [categoryQuery, setCategoryQuery] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const hydrateRows = (rows: BookItem[], activeBookIds: Set<number>): BookRow[] =>
    rows.map((b) => ({
      id: b.book_id,
      book_name: b.book_name,
      cover_image: b.cover_image ?? "",
      author_name: b.author_name || `Author #${b.author_id}`,
      category_name: b.category_name || `Category #${b.category_id}`,
      status: activeBookIds.has(b.book_id) ? "unavailable" : "available",
      release_date: b.release_date ?? "-",
      description: b.description ?? "",
      place: b.place ?? "",
      author_id: b.author_id,
      category_id: b.category_id
    }));

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [bookRows, authorRows, categoryRows, rentRows] = await Promise.all([
        getBooks(),
        getAuthors(),
        getCategories(),
        getRentList()
      ]);
      const activeBookIds = new Set(
        rentRows.filter((r) => !r.return_date).map((r) => Number(r.Books_book_id)).filter((id) => Number.isFinite(id))
      );
      setBooks(hydrateRows(bookRows, activeBookIds));
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
    let rows = books;
    if (statusFilter !== "all") {
      rows = rows.filter((r) => r.status === statusFilter);
    }
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        String(r.book_name).toLowerCase().includes(s) ||
        String(r.author_name).toLowerCase().includes(s) ||
        String(r.category_name).toLowerCase().includes(s) ||
        String(r.place).toLowerCase().includes(s)
    );
  }, [books, q, statusFilter]);

  const filterResetKey = `${q}|${statusFilter}`;

  useEffect(() => {
    setPage(1);
  }, [q, statusFilter]);

  const sortedFiltered = useMemo(
    () => sortRows(filtered, sortKey, sortOrder),
    [filtered, sortKey, sortOrder],
  );

  const totalSorted = sortedFiltered.length;

  const paginatedBooks = useMemo(() => {
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

  const tableRows =
    ADMIN_TABLE_DISPLAY_MODE === "infinite"
      ? infiniteScroll.visibleSlice
      : paginatedBooks;

  const rowNumberBase =
    ADMIN_TABLE_DISPLAY_MODE === "infinite" ? 0 : (page - 1) * limit;

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
                View all books
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setAuthorQuery("");
    setCategoryQuery("");
    setShelf("");
    setRowNumber("");
  };

  const startCreate = () => {
    resetForm();
    setOpenForm(true);
  };

  const startEdit = (row: BookRow) => {
    const placeMatch = row.place?.match(/Shelf \((\d+)\) Row \((\d+)\)/);
    setShelf(placeMatch?.[1] ?? "");
    setRowNumber(placeMatch?.[2] ?? "");
    setForm({
      book_name: row.book_name,
      author_id: row.author_id,
      author_name: "",
      category_id: row.category_id,
      category_name: "",
      release_date: row.release_date === "-" ? "" : row.release_date,
      description: row.description,
      cover_file: null,
      cover_image: row.cover_image ?? "",
      place: row.place
    });
    setEditingId(row.id);
    setOpenForm(true);
  };

  const startDelete = (row: BookRow) => {
    setSelected(row);
    setOpenDelete(true);
  };

  const goToDetail = (row: BookRow) => navigate(`/admin/books/${row.id}`);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((shelf && !rowNumber) || (!shelf && rowNumber)) {
      setToast({ kind: "error", message: "Please provide both shelf and row numbers for place." });
      return;
    }
    const place = shelf && rowNumber ? `Shelf (${shelf}) Row (${rowNumber})` : "";
    const payload: BookPayload = {
      ...form,
      place,
      author_id: form.author_id || undefined,
      category_id: form.category_id || undefined,
      author_name: form.author_id ? undefined : form.author_name?.trim(),
      category_name: form.category_id ? undefined : form.category_name?.trim()
    };
    if ((!payload.author_id && !payload.author_name) || (!payload.category_id && !payload.category_name)) {
      setToast({ kind: "error", message: "Please select or add author and category." });
      return;
    }
    try {
      setSaving(true);
      if (editingId) {
        await updateBook(editingId, payload);
        setToast({ kind: "success", message: "Book updated successfully." });
      } else {
        await createBook(payload);
        setToast({ kind: "success", message: "Book created successfully." });
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
      await deleteBook(selected.id);
      setToast({ kind: "success", message: "Book deleted successfully." });
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
    { key: "book_name" as const, title: "Book Name", sortable: true },
    {
      key: "cover_image" as const,
      title: "Cover",
      render: (row: BookRow) => (
        <div className="h-16 w-12 overflow-hidden rounded-md border border-slate-200 bg-slate-100 dark:border-slate-600 dark:bg-slate-700">
          {row.cover_image ? (
            <img
              src={row.cover_image}
              alt={row.book_name}
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
    { key: "place" as const, title: "Place", sortable: true, render: (row: BookRow) => row.place || "-" },
    {
      key: "status" as const,
      title: "Status",
      sortable: true,
      headerCell: statusHeaderMenu,
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
    { key: "release_date" as const, title: "Release Date", sortable: true },
    {
      key: "description" as const,
      title: "Description",
      sortable: true,
      render: (row: BookRow) => (
        <div className="max-w-[220px]">
          <span className="block truncate" title={row.description || "-"}>
            {row.description || "-"}
          </span>
          {row.description && row.description.length > 60 && (
            <button
              type="button"
              className="mt-1 text-xs font-semibold text-primary hover:underline"
              onClick={() => goToDetail(row)}
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
      render: (row: BookRow) => (
        <div className="flex flex-wrap gap-1">
          <button type="button" className={actionClass} title="View" onClick={() => goToDetail(row)}>
            <Eye className="h-4 w-4" />
          </button>
          <button type="button" className={actionClass} title="Edit" onClick={() => startEdit(row)}>
            <Pencil className="h-4 w-4" />
          </button>
          <Tooltip text={!isSuperAdmin() ? SUPER_ADMIN_ONLY_TOOLTIP : "Delete book"}>
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <motion.div initial={false} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Books Management</h2>
          {/* <p className="text-sm text-slate-600 dark:text-slate-400">Physical catalog — API ready.</p> */}
        </motion.div>
        <Button type="button" className="inline-flex items-center gap-2 self-start" onClick={startCreate}>
          <Plus className="h-4 w-4" />
          Add New Book
        </Button>
      </div>

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
            placeholder="Search books…"
            className="pl-10"
            aria-label="Search books"
          />
        </div>
      </AdminTableToolbar>

      <motion.div initial={false} animate={{ opacity: 1 }} transition={{ delay: 0.02 }}>
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            Loading books...
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            No books found.
          </div>
        ) : (
          <>
            <Table<BookRow>
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

      <Modal open={openForm} title={editingId ? "Edit book" : "Add book"} onClose={() => setOpenForm(false)}>
        <form className="space-y-3" onSubmit={onSave}>
          <Input
            name="book_name"
            placeholder="Book name"
            value={form.book_name}
            onChange={(e) => setForm((prev) => ({ ...prev, book_name: e.target.value }))}
            required
          />
          <SearchableSelect
            options={authors.map((a) => ({ value: a.author_id, label: a.author_name }))}
            value={form.author_id || 0}
            onValueChange={(value) =>
              setForm((prev) => ({
                ...prev,
                author_id: value,
                author_name: value ? "" : prev.author_name
              }))
            }
            placeholder="Select author"
            onQueryChange={(query, exactMatch) => {
              setAuthorQuery(query);
              if (!exactMatch) {
                setForm((prev) => ({ ...prev, author_id: 0, author_name: query }));
              }
            }}
            createHint={
              authorQuery.trim() && !form.author_id
                ? `➕ Add '${authorQuery.trim()}'`
                : null
            }
            onCreateHintClick={() =>
              setForm((prev) => ({
                ...prev,
                author_id: 0,
                author_name: authorQuery.trim()
              }))
            }
          />
          <SearchableSelect
            options={categories.map((c) => ({ value: c.category_id, label: c.category_name }))}
            value={form.category_id || 0}
            onValueChange={(value) =>
              setForm((prev) => ({
                ...prev,
                category_id: value,
                category_name: value ? "" : prev.category_name
              }))
            }
            placeholder="Select category"
            onQueryChange={(query, exactMatch) => {
              setCategoryQuery(query);
              if (!exactMatch) {
                setForm((prev) => ({ ...prev, category_id: 0, category_name: query }));
              }
            }}
            createHint={
              categoryQuery.trim() && !form.category_id
                ? `➕ Add '${categoryQuery.trim()}'`
                : null
            }
            onCreateHintClick={() =>
              setForm((prev) => ({
                ...prev,
                category_id: 0,
                category_name: categoryQuery.trim()
              }))
            }
          />
          <DatePicker
            value={form.release_date}
            onChange={(date) => setForm((prev) => ({ ...prev, release_date: date }))}
            placeholder="Select release date"
            required
          />
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Shelf</span>
              <Input
                type="number"
                min="1"
                value={shelf}
                onChange={(e) => setShelf(e.target.value)}
                className="w-20"
                placeholder="2"
              />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Row</span>
              <Input
                type="number"
                min="1"
                value={rowNumber}
                onChange={(e) => setRowNumber(e.target.value)}
                className="w-20"
                placeholder="3"
              />
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Stored as: {shelf && rowNumber ? `Shelf (${shelf}) Row (${rowNumber})` : "-"}
            </p>
          </div>
          <textarea
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            rows={4}
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          />
          <FileUpload
            label="Upload Cover Image"
            accept="image/*"
            fileName={form.cover_file?.name || form.cover_image?.split("/").pop() || ""}
            onFileChange={(file) => setForm((prev) => ({ ...prev, cover_file: file }))}
          />
          {(form.cover_file || form.cover_image) && (
            <div className="w-fit overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
              <img
                src={form.cover_file ? URL.createObjectURL(form.cover_file) : form.cover_image || ""}
                alt="Cover preview"
                className="h-24 w-16 object-cover"
              />
            </div>
          )}
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

      <Modal open={openDelete} title="Delete book" onClose={() => setOpenDelete(false)}>
        <div className="space-y-4">
          <p className="text-sm text-slate-700 dark:text-slate-200">
            Are you sure you want to delete <span className="font-semibold">{selected?.book_name}</span>?
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

export default Books;
