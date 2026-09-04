import { motion } from "framer-motion";
import { Eye, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Modal from "../../components/ui/Modal";
import TablePagination from "../../components/ui/TablePagination";
import { Table } from "../../components/ui/Table";
import {
  AuthorOption,
  AuthorPayload,
  createAuthor,
  deleteAuthor,
  getApiErrorMessage,
  getAuthors,
  updateAuthor
} from "../../services/api";

type AuthorRow = Record<string, unknown> & {
  id: number;
  name: string;
  country: string;
};

type Toast = { kind: "success" | "error"; message: string } | null;

const actionClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700";

const emptyForm: AuthorPayload = { author_name: "", country: "" };

const Authors = () => {
  const [rows, setRows] = useState<AuthorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const [openForm, setOpenForm] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const [openView, setOpenView] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selected, setSelected] = useState<AuthorRow | null>(null);
  const [form, setForm] = useState<AuthorPayload>(emptyForm);
  const [toast, setToast] = useState<Toast>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const hydrateRows = (list: AuthorOption[]): AuthorRow[] =>
    list.map((a) => ({
      id: a.author_id,
      name: a.author_name,
      country: a.country?.trim() ? a.country : "—"
    }));

  const fetchAll = async () => {
    try {
      setLoading(true);
      const data = await getAuthors();
      setRows(hydrateRows(data));
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
    return rows.filter(
      (r) => String(r.name).toLowerCase().includes(s) || String(r.country).toLowerCase().includes(s)
    );
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

  const startEdit = (row: AuthorRow) => {
    setForm({
      author_name: row.name,
      country: row.country === "—" ? "" : row.country
    });
    setEditingId(row.id);
    setOpenForm(true);
  };

  const startDelete = (row: AuthorRow) => {
    setSelected(row);
    setOpenDelete(true);
  };

  const startView = (row: AuthorRow) => {
    setSelected(row);
    setOpenView(true);
  };

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      if (editingId) {
        await updateAuthor(editingId, form);
        setToast({ kind: "success", message: "Author updated successfully." });
      } else {
        await createAuthor(form);
        setToast({ kind: "success", message: "Author created successfully." });
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
      await deleteAuthor(selected.id);
      setToast({ kind: "success", message: "Author deleted successfully." });
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
    { key: "country" as const, title: "Country" },
    {
      key: "id" as const,
      title: "Actions",
      render: (row: AuthorRow) => (
        <div className="flex flex-wrap gap-1">
          <button type="button" className={actionClass} title="View" onClick={() => startView(row)}>
            <Eye className="h-4 w-4" />
          </button>
          <button type="button" className={actionClass} title="Edit" onClick={() => startEdit(row)}>
            <Pencil className="h-4 w-4" />
          </button>
          <button type="button" className={actionClass} title="Delete" onClick={() => startDelete(row)}>
            <Trash2 className="h-4 w-4 text-rose-500" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <motion.div initial={false} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Author Management</h2>
          {/* <p className="text-sm text-slate-600 dark:text-slate-400">Author directory — API ready.</p> */}
        </motion.div>
        <Button type="button" className="inline-flex items-center gap-2 self-start" onClick={startCreate}>
          <Plus className="h-4 w-4" />
          Add author
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
          placeholder="Search authors..."
          className="pl-10"
          aria-label="Search authors"
        />
      </div>

      <motion.div initial={false} animate={{ opacity: 1 }} transition={{ delay: 0.02 }}>
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            Loading authors...
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            No authors found.
          </div>
        ) : (
          <>
            <Table<AuthorRow>
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

      <Modal open={openForm} title={editingId ? "Edit author" : "Add author"} onClose={() => setOpenForm(false)}>
        <form className="space-y-3" onSubmit={onSave}>
          <Input
            name="author_name"
            placeholder="Full name"
            value={form.author_name}
            onChange={(e) => setForm((p) => ({ ...p, author_name: e.target.value }))}
            required
          />
          <Input
            name="country"
            placeholder="Country (optional)"
            value={form.country}
            onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))}
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

      <Modal open={openDelete} title="Delete author" onClose={() => setOpenDelete(false)}>
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

      <Modal open={openView} title="Author details" onClose={() => setOpenView(false)}>
        <div className="space-y-3 text-sm text-slate-700 dark:text-slate-200">
          <p>
            <span className="font-semibold">Name:</span> {selected?.name}
          </p>
          <p>
            <span className="font-semibold">Country:</span> {selected?.country}
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

export default Authors;
