import { motion } from "framer-motion";
import { Eye, GitMerge, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Modal from "../../components/ui/Modal";
import TablePagination from "../../components/ui/TablePagination";
import Tooltip from "../../components/ui/Tooltip";
import { Table } from "../../components/ui/Table";
import PageHeader from "../../components/ui/PageHeader";
import { isSuperAdmin, SUPER_ADMIN_ONLY_TOOLTIP } from "../../utils/auth";
import {
  CategoryOption,
  CategoryPayload,
  createCategory,
  deleteCategory,
  getApiErrorMessage,
  getCategories,
  mergeCategories,
  updateCategory
} from "../../services/api";

type CategoryScope = "all" | "books" | "ebooks" | "papers";

type CategoryRow = Record<string, unknown> & {
  id: number;
  name: string;
  bookCount: number;
  ebookCount: number;
  paperCount: number;
  _select?: number;
  _actions?: number;
};

type Toast = { kind: "success" | "error"; message: string } | null;

const actionClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700";

const emptyForm: CategoryPayload = { category_name: "" };

const SCOPE_TABS: { id: CategoryScope; label: string }[] = [
  { id: "all", label: "All" },
  { id: "books", label: "Books" },
  { id: "ebooks", label: "e-Books" },
  { id: "papers", label: "Research Papers" }
];

const Categories = () => {
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<CategoryScope>("all");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [openForm, setOpenForm] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const [openView, setOpenView] = useState(false);
  const [openMerge, setOpenMerge] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selected, setSelected] = useState<CategoryRow | null>(null);
  const [form, setForm] = useState<CategoryPayload>(emptyForm);
  const [toast, setToast] = useState<Toast>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  const toRow = (c: CategoryOption): CategoryRow => ({
    id: c.category_id,
    name: c.category_name,
    bookCount: c.book_count ?? 0,
    ebookCount: c.ebook_count ?? 0,
    paperCount: c.paper_count ?? 0
  });

  const fetchAll = async () => {
    try {
      setLoading(true);
      const categoryRows = await getCategories({ counts: true });
      setRows(categoryRows.map(toRow));
      setSelectedIds(new Set());
    } catch (err) {
      setToast({ kind: "error", message: getApiErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAll();
  }, []);

  const scopeCounts = useMemo(() => {
    const books = rows.filter((r) => r.bookCount > 0).length;
    const ebooks = rows.filter((r) => r.ebookCount > 0).length;
    const papers = rows.filter((r) => r.paperCount > 0).length;
    return { all: rows.length, books, ebooks, papers };
  }, [rows]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (scope === "books" && r.bookCount <= 0) return false;
      if (scope === "ebooks" && r.ebookCount <= 0) return false;
      if (scope === "papers" && r.paperCount <= 0) return false;
      if (!s) return true;
      return String(r.name).toLowerCase().includes(s);
    });
  }, [rows, q, scope]);

  useEffect(() => {
    setPage(1);
  }, [q, scope]);

  const totalFiltered = filtered.length;

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * limit;
    return filtered.slice(start, start + limit);
  }, [filtered, page, limit]);

  useEffect(() => {
    const tp = totalFiltered === 0 ? 1 : Math.ceil(totalFiltered / limit);
    if (page > tp) setPage(tp);
  }, [totalFiltered, limit, page]);

  const pageIds = paginatedRows.map((r) => r.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));

  const toggleOne = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const togglePage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const selectedRows = useMemo(
    () => rows.filter((r) => selectedIds.has(r.id)),
    [rows, selectedIds]
  );

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const startCreate = () => {
    resetForm();
    setOpenForm(true);
  };

  const startEdit = (row: CategoryRow) => {
    setForm({ category_name: row.name });
    setEditingId(row.id);
    setOpenForm(true);
  };

  const startDelete = (row: CategoryRow) => {
    setSelected(row);
    setOpenDelete(true);
  };

  const startView = (row: CategoryRow) => {
    setSelected(row);
    setOpenView(true);
  };

  const startMerge = () => {
    if (selectedRows.length < 2) {
      setToast({ kind: "error", message: "Select at least 2 categories to merge." });
      return;
    }
    const preferred =
      selectedRows.slice().sort((a, b) => {
        const totalA = a.bookCount + a.ebookCount + a.paperCount;
        const totalB = b.bookCount + b.ebookCount + b.paperCount;
        return totalB - totalA || a.name.localeCompare(b.name);
      })[0];
    setMergeTargetId(preferred?.id ?? selectedRows[0].id);
    setOpenMerge(true);
  };

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      if (editingId) {
        await updateCategory(editingId, form);
        setToast({ kind: "success", message: "Category updated successfully." });
      } else {
        await createCategory(form);
        setToast({ kind: "success", message: "Category created successfully." });
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
      await deleteCategory(selected.id);
      setToast({ kind: "success", message: "Category deleted successfully." });
      setOpenDelete(false);
      setSelected(null);
      await fetchAll();
    } catch (err) {
      setToast({ kind: "error", message: getApiErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const onMerge = async () => {
    if (!mergeTargetId || selectedRows.length < 2) return;
    const sourceIds = selectedRows.map((r) => r.id).filter((id) => id !== mergeTargetId);
    if (!sourceIds.length) {
      setToast({ kind: "error", message: "Pick a keep category different from the ones being merged." });
      return;
    }
    try {
      setSaving(true);
      const result = await mergeCategories({ targetId: mergeTargetId, sourceIds });
      setToast({
        kind: "success",
        message: `Merged into "${result.targetName}" · ${result.booksMoved} book(s), ${result.ebooksMoved} e-book/paper(s) moved.`
      });
      setOpenMerge(false);
      setMergeTargetId(null);
      await fetchAll();
    } catch (err) {
      setToast({ kind: "error", message: getApiErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const searchPlaceholder =
    scope === "books"
      ? "Search categories used by Books…"
      : scope === "ebooks"
        ? "Search categories used by e-Books…"
        : scope === "papers"
          ? "Search categories used by Research Papers…"
          : "Search all categories…";

  const columns = [
    {
      key: "_select" as const,
      title: "Select",
      headerCell: (
        <input
          type="checkbox"
          checked={allPageSelected}
          onChange={togglePage}
          aria-label="Select page"
          className="h-4 w-4 rounded border-slate-300"
        />
      ),
      render: (row: CategoryRow) => (
        <input
          type="checkbox"
          checked={selectedIds.has(row.id)}
          onChange={() => toggleOne(row.id)}
          aria-label={`Select ${row.name}`}
          className="h-4 w-4 rounded border-slate-300"
        />
      )
    },
    { key: "name" as const, title: "Name" },
    { key: "bookCount" as const, title: "Books" },
    { key: "ebookCount" as const, title: "e-Books" },
    { key: "paperCount" as const, title: "Research Papers" },
    {
      key: "_actions" as const,
      title: "Actions",
      render: (row: CategoryRow) => (
        <div className="flex flex-wrap gap-1">
          <button type="button" className={actionClass} title="View" onClick={() => startView(row)}>
            <Eye className="h-4 w-4" />
          </button>
          <button type="button" className={actionClass} title="Edit" onClick={() => startEdit(row)}>
            <Pencil className="h-4 w-4" />
          </button>
          <Tooltip text={!isSuperAdmin() ? SUPER_ADMIN_ONLY_TOOLTIP : "Delete category"}>
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
        title="Categories Management"
        description="Filter by Books, e-Books, or Research Papers, then merge duplicates."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {isSuperAdmin() && (
              <Button
                type="button"
                variant="secondary"
                className="inline-flex items-center gap-2"
                onClick={startMerge}
                disabled={selectedIds.size < 2}
              >
                <GitMerge className="h-4 w-4" />
                Merge selected ({selectedIds.size})
              </Button>
            )}
            <Button type="button" className="inline-flex items-center gap-2" onClick={startCreate}>
              <Plus className="h-4 w-4" />
              Add category
            </Button>
          </div>
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

      <div className="flex flex-wrap gap-2">
        {SCOPE_TABS.map((tab) => {
          const count = scopeCounts[tab.id];
          const active = scope === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setScope(tab.id)}
              className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                active
                  ? "border-primary bg-primary/10 text-primary dark:border-primary dark:bg-primary/20"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {tab.label}
              <span className="ml-2 text-xs opacity-70">{count.toLocaleString()}</span>
            </button>
          );
        })}
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={searchPlaceholder}
          className="pl-10"
          aria-label="Search categories"
        />
      </div>

      <p className="text-sm text-slate-500 dark:text-slate-400">
        Showing {totalFiltered.toLocaleString()} categor
        {totalFiltered === 1 ? "y" : "ies"}
        {scope !== "all" ? ` in ${SCOPE_TABS.find((t) => t.id === scope)?.label}` : ""}
        {selectedIds.size > 0 ? ` · ${selectedIds.size} selected` : ""}
      </p>

      <motion.div initial={false} animate={{ opacity: 1 }} transition={{ delay: 0.02 }}>
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            Loading categories...
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            No categories found.
          </div>
        ) : (
          <>
            <Table<CategoryRow>
              columns={columns}
              data={paginatedRows}
              rowNumberBase={(page - 1) * limit}
            />
            <TablePagination
              page={page}
              limit={limit}
              total={totalFiltered}
              onPageChange={setPage}
              onLimitChange={(val) => {
                setLimit(val);
                setPage(1);
              }}
            />
          </>
        )}
      </motion.div>

      <Modal open={openForm} title={editingId ? "Edit category" : "Add category"} onClose={() => setOpenForm(false)}>
        <form className="space-y-3" onSubmit={onSave}>
          <Input
            name="category_name"
            placeholder="Category name"
            value={form.category_name}
            onChange={(e) => setForm({ category_name: e.target.value })}
            required
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

      <Modal open={openDelete} title="Delete category" onClose={() => setOpenDelete(false)}>
        <div className="space-y-4">
          <p className="text-sm text-slate-700 dark:text-slate-200">
            Are you sure you want to delete <span className="font-semibold">{selected?.name}</span>?
            {(selected?.bookCount ?? 0) + (selected?.ebookCount ?? 0) + (selected?.paperCount ?? 0) > 0
              ? " This category still has items — merge them first."
              : ""}
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

      <Modal open={openView} title="Category details" onClose={() => setOpenView(false)}>
        <div className="space-y-3 text-sm text-slate-700 dark:text-slate-200">
          <p>
            <span className="font-semibold">Name:</span> {selected?.name}
          </p>
          <p>
            <span className="font-semibold">Books:</span> {selected?.bookCount}
          </p>
          <p>
            <span className="font-semibold">e-Books:</span> {selected?.ebookCount}
          </p>
          <p>
            <span className="font-semibold">Research Papers:</span> {selected?.paperCount}
          </p>
          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={() => setOpenView(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={openMerge} title="Merge categories" onClose={() => setOpenMerge(false)}>
        <div className="space-y-4">
          <p className="text-sm text-slate-700 dark:text-slate-200">
            All books, e-books, and research papers from the other selected categories will move into the
            category you keep. The other categories will be deleted.
          </p>
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-slate-800 dark:text-white">Keep this category</legend>
            {selectedRows.map((row) => (
              <label
                key={row.id}
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-600"
              >
                <input
                  type="radio"
                  name="merge-target"
                  checked={mergeTargetId === row.id}
                  onChange={() => setMergeTargetId(row.id)}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium text-slate-800 dark:text-white">{row.name}</span>
                  <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                    Books {row.bookCount} · e-Books {row.ebookCount} · Papers {row.paperCount}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpenMerge(false)}>
              Cancel
            </Button>
            <Button type="button" variant="danger" onClick={onMerge} disabled={saving || !mergeTargetId}>
              {saving ? "Merging..." : "Merge"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Categories;
