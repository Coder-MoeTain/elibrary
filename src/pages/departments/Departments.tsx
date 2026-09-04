import { motion } from "framer-motion";
import { Eye, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Modal from "../../components/ui/Modal";
import AdminTableToolbar from "../../components/ui/AdminTableToolbar";
import TableInfiniteFooter from "../../components/ui/TableInfiniteFooter";
import TablePagination from "../../components/ui/TablePagination";
import { Table } from "../../components/ui/Table";
import PageHeader from "../../components/ui/PageHeader";
import { useAdminTableInfiniteScroll } from "../../components/ui/useAdminTableInfiniteScroll";
import { ADMIN_TABLE_DISPLAY_MODE } from "../../config/adminTableMode";
import { isSuperAdmin, SUPER_ADMIN_ONLY_TOOLTIP } from "../../utils/auth";
import { sortRows } from "../../utils/tableSort";
import Tooltip from "../../components/ui/Tooltip";
import {
  createDepartment,
  deleteDepartment,
  DepartmentItem,
  DepartmentPayload,
  getApiErrorMessage,
  getDepartmentList,
  isAxiosConflict,
  updateDepartment,
} from "../../services/api";

type DeptRow = Record<string, unknown> & {
  id: number;
  name: string;
  head: string;
  dependency_count: number;
  is_archived: boolean;
};

type Toast = { kind: "success" | "error" | "warning"; message: string } | null;

const actionClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700";

const emptyForm: DepartmentPayload = { department_name: "" };

const Departments = () => {
  const [rows, setRows] = useState<DeptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const [openForm, setOpenForm] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const [openView, setOpenView] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selected, setSelected] = useState<DeptRow | null>(null);
  const [form, setForm] = useState<DepartmentPayload>(emptyForm);
  const [toast, setToast] = useState<Toast>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const hydrateRows = (list: DepartmentItem[]): DeptRow[] =>
    list.map((d) => ({
      id: d.department_id,
      name: d.department_name,
      head: "",
      dependency_count: d.user_dependency_count ?? 0,
      is_archived: Boolean(d.is_deleted),
    }));

  const fetchAll = async () => {
    try {
      setLoading(true);
      const data = await getDepartmentList(showArchived);
      setRows(hydrateRows(data));
    } catch (err) {
      setToast({ kind: "error", message: getApiErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAll();
  }, [showArchived]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        String(r.name).toLowerCase().includes(s) ||
        String(r.head).toLowerCase().includes(s),
    );
  }, [rows, q]);

  const filterResetKey = `${q}|${showArchived}`;

  useEffect(() => {
    setPage(1);
  }, [q, showArchived]);

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

  const tableRows =
    ADMIN_TABLE_DISPLAY_MODE === "infinite"
      ? infiniteScroll.visibleSlice
      : paginatedRows;

  const rowNumberBase =
    ADMIN_TABLE_DISPLAY_MODE === "infinite" ? 0 : (page - 1) * limit;

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const startCreate = () => {
    resetForm();
    setOpenForm(true);
  };

  const startEdit = (row: DeptRow) => {
    setForm({ department_name: row.name });
    setEditingId(row.id);
    setOpenForm(true);
  };

  const startDelete = (row: DeptRow) => {
    setSelected(row);
    setOpenDelete(true);
  };

  const startView = (row: DeptRow) => {
    setSelected(row);
    setOpenView(true);
  };

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = form.department_name.trim();
    if (!trimmedName) {
      setToast({ kind: "error", message: "Department name is required." });
      return;
    }
    if (trimmedName.length > 255) {
      setToast({ kind: "error", message: "Department name must be less than or equal to 255 characters." });
      return;
    }
    try {
      setSaving(true);
      if (editingId != null) {
        await updateDepartment(editingId, { department_name: trimmedName });
        setToast({
          kind: "success",
          message: "Department updated successfully.",
        });
      } else {
        const { restored } = await createDepartment({ department_name: trimmedName });
        setToast({
          kind: "success",
          message: restored
            ? "Department restored successfully."
            : "Department created successfully.",
        });
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
    if (selected.is_archived) {
      setToast({
        kind: "warning",
        message: "This department is already archived.",
      });
      return;
    }
    if (selected.dependency_count > 0) {
      setToast({
        kind: "warning",
        message: `Cannot archive — ${selected.dependency_count} user(s) still assigned to this department.`,
      });
      return;
    }
    try {
      setSaving(true);
      await deleteDepartment(selected.id);
      setToast({
        kind: "success",
        message: "Department archived successfully.",
      });
      setOpenDelete(false);
      setSelected(null);
      await fetchAll();
    } catch (err) {
      setToast({
        kind: isAxiosConflict(err) ? "warning" : "error",
        message: getApiErrorMessage(err),
      });
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: "name" as const, title: "Department", sortable: true },
    {
      key: "dependency_count" as const,
      title: "Users Count",
      sortable: true,
      render: (row: DeptRow) => (
        <div className="flex flex-wrap items-center gap-2">
          {row.dependency_count > 0 ? (
            <span className="font-semibold text-amber-600 dark:text-amber-400">
              {row.dependency_count} user{row.dependency_count === 1 ? "" : "s"}
            </span>
          ) : (
            <span className="text-slate-400 dark:text-slate-500">0</span>
          )}
          {row.is_archived && (
            <span className="rounded-md bg-slate-200 px-1.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-600 dark:text-slate-200">
              Archived
            </span>
          )}
        </div>
      ),
    },
    {
      key: "head" as const,
      title: "Actions",
      render: (row: DeptRow) => {
        const archiveDisabled = row.is_archived || row.dependency_count > 0;
        const archiveTooltip = row.is_archived
          ? "Department is already archived."
          : row.dependency_count > 0
            ? `Cannot archive: ${row.dependency_count} user(s) assigned.`
            : "Archive department";
        const superOnly = !isSuperAdmin();
        const archiveBtnDisabled = archiveDisabled || superOnly;
        const archiveBtnTooltip = superOnly ? SUPER_ADMIN_ONLY_TOOLTIP : archiveTooltip;
        return (
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              className={actionClass}
              title="View"
              onClick={() => startView(row)}
            >
              <Eye className="h-4 w-4" />
            </button>
            <Tooltip
              text={
                row.is_archived
                  ? "Cannot edit archived department"
                  : "Edit department"
              }
            >
              <span className="inline-flex">
                <button
                  type="button"
                  title="Edit"
                  disabled={row.is_archived}
                  onClick={() => startEdit(row)}
                  className={`${actionClass} ${row.is_archived ? "cursor-not-allowed opacity-50" : ""}`}
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </span>
            </Tooltip>
            <Tooltip text={archiveBtnTooltip}>
              <span className="inline-flex">
                <button
                  type="button"
                  disabled={archiveBtnDisabled}
                  className={`${actionClass} ${archiveBtnDisabled ? "cursor-not-allowed opacity-50" : ""}`}
                  title="Archive"
                  onClick={() => !archiveBtnDisabled && startDelete(row)}
                >
                  <Trash2 className="h-4 w-4 text-rose-500" />
                </button>
              </span>
            </Tooltip>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Department Management"
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                className="rounded border-slate-300 text-primary focus:ring-primary dark:border-slate-600"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />
              Show archived
            </label>
            <Button type="button" className="inline-flex items-center gap-2" onClick={startCreate}>
              <Plus className="h-4 w-4" />
              Add department
            </Button>
          </div>
        }
      />

      {toast && (
        <div
          className={`rounded-xl border px-3 py-2 text-sm ${
            toast.kind === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
              : toast.kind === "warning"
                ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-100"
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
            placeholder="Search departments…"
            className="pl-10"
            aria-label="Search departments"
          />
        </div>
      </AdminTableToolbar>

      <motion.div initial={false} animate={{ opacity: 1 }} transition={{ delay: 0.02 }}>
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            Loading departments...
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            No departments found.
          </div>
        ) : (
          <>
            <Table<DeptRow>
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

      <Modal
        open={openForm}
        title={editingId != null ? "Edit department" : "Add department"}
        onClose={() => setOpenForm(false)}
      >
        <form className="space-y-3" onSubmit={onSave}>
          <Input
            name="department_name"
            placeholder="Department name"
            value={form.department_name}
            onChange={(e) => setForm({ department_name: e.target.value })}
            required
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpenForm(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={openDelete}
        title="Archive department"
        onClose={() => setOpenDelete(false)}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-700 dark:text-slate-200">
            Archive <span className="font-semibold">{selected?.name}</span>? It
            will be hidden from registration and lists while no users reference
            it.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpenDelete(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={onDelete}
              disabled={saving}
            >
              {saving ? "Archiving..." : "Archive"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={openView}
        title="Department details"
        onClose={() => setOpenView(false)}
      >
        <div className="space-y-3 text-sm text-slate-700 dark:text-slate-200">
          <p>
            <span className="font-semibold">Department:</span> {selected?.name}
          </p>
          {/* <p>
            <span className="font-semibold">Head:</span> {selected?.head}
          </p> */}
          <div className="flex justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpenView(false)}
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Departments;
