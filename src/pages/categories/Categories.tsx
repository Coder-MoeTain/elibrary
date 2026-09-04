import { motion } from "framer-motion";
import { Eye, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Modal from "../../components/ui/Modal";
import TablePagination from "../../components/ui/TablePagination";
import Tooltip from "../../components/ui/Tooltip";
import { Table } from "../../components/ui/Table";
import { isSuperAdmin, SUPER_ADMIN_ONLY_TOOLTIP } from "../../utils/auth";
import {
  BookItem,
  CategoryOption,
  CategoryPayload,
  createCategory,
  deleteCategory,
  EbookItem,
  getApiErrorMessage,
  getBooks,
  getCategories,
  getEbooks,
  updateCategory
} from "../../services/api";

type CategoryRow = Record<string, unknown> & {
  id: number;
  name: string;
  bookCount: number;
  ebookCount: number;
};

type Toast = { kind: "success" | "error"; message: string } | null;

const actionClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700";

const emptyForm: CategoryPayload = { category_name: "" };

const Categories = () => {
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const [openForm, setOpenForm] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const [openView, setOpenView] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selected, setSelected] = useState<CategoryRow | null>(null);
  const [form, setForm] = useState<CategoryPayload>(emptyForm);
  const [toast, setToast] = useState<Toast>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const hydrateRows = (
    list: CategoryOption[],
    books: BookItem[],
    ebooks: EbookItem[]
  ): CategoryRow[] => {
    const bookCountByCategory = new Map<number, number>();
    for (const book of books) {
      bookCountByCategory.set(
        book.category_id,
        (bookCountByCategory.get(book.category_id) ?? 0) + 1
      );
    }
    const ebookCountByCategory = new Map<number, number>();
    for (const ebook of ebooks) {
      ebookCountByCategory.set(
        ebook.category_id,
        (ebookCountByCategory.get(ebook.category_id) ?? 0) + 1
      );
    }
    return list.map((c) => ({
      id: c.category_id,
      name: c.category_name,
      bookCount: bookCountByCategory.get(c.category_id) ?? 0,
      ebookCount: ebookCountByCategory.get(c.category_id) ?? 0
    }));
  };

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [categoryRows, bookRows, ebookRows] = await Promise.all([
        getCategories(),
        getBooks(),
        getEbooks()
      ]);
      setRows(hydrateRows(categoryRows, bookRows, ebookRows));
    } catch (err) {
      setToast({ kind: "error", message: getApiErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAll();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => String(r.name).toLowerCase().includes(s));
  }, [rows, q]);

  useEffect(() => {
    setPage(1);
  }, [q]);

  const totalFiltered = filtered.length;

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * limit;
    return filtered.slice(start, start + limit);
  }, [filtered, page, limit]);

  useEffect(() => {
    const tp = totalFiltered === 0 ? 1 : Math.ceil(totalFiltered / limit);
    if (page > tp) setPage(tp);
  }, [totalFiltered, limit, page]);

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

  const columns = [
    { key: "name" as const, title: "Name" },
    { key: "bookCount" as const, title: "Books" },
    { key: "ebookCount" as const, title: "e-Books" },
    {
      key: "id" as const,
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <motion.div initial={false} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Categories Management</h2>
          {/* <p className="text-sm text-slate-600 dark:text-slate-400">Organize your catalog.</p> */}
        </motion.div>
        <Button type="button" className="inline-flex items-center gap-2 self-start" onClick={startCreate}>
          <Plus className="h-4 w-4" />
          Add category
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

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search categories..."
          className="pl-10"
          aria-label="Search categories"
        />
      </div>

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
          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={() => setOpenView(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Categories;
