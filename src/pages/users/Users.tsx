import { motion } from "framer-motion";
import { ChevronDown, Eye, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Button from "../../components/ui/Button";
import DatePicker from "../../components/ui/DatePicker";
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
  acceptUser,
  createUser,
  deleteUser,
  DepartmentItem,
  getApiErrorMessage,
  getDepartmentList,
  getUsers,
  isAxiosConflict,
  rejectUser,
  updateUser,
  UserItem,
  UserPayload,
} from "../../services/api";

type UserRow = Record<string, unknown> & {
  id: number;
  user_name: string;
  email: string;
  dob: string;
  status: string;
  department: string;
  department_id: number;
  active_rental_count: number;
  is_archived: boolean;
  _actions: string;
};

type Toast = { kind: "success" | "error" | "warning"; message: string } | null;

type StatusFilterValue = "all" | "PENDING" | "APPROVED" | "REJECTED";

function parseStatusFilter(raw: string | null): StatusFilterValue {
  const value = String(raw || "").trim().toUpperCase();
  if (value === "PENDING" || value === "APPROVED" || value === "REJECTED") {
    return value;
  }
  return "all";
}

const STATUS_FILTER_OPTIONS: {
  value: Exclude<StatusFilterValue, "all">;
  label: string;
}[] = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

const emptyForm = {
  userName: "",
  email: "",
  dateOfBirth: "",
  departmentId: 0,
  password: "",
};

const actionClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700";

const Users = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>(() =>
    parseStatusFilter(searchParams.get("status")),
  );
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const statusHeaderRef = useRef<HTMLDivElement>(null);
  const [openForm, setOpenForm] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const [openView, setOpenView] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [toast, setToast] = useState<Toast>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const rows = await getUsers(showArchived);
      setUsers(rows);
    } catch (err) {
      setToast({ kind: "error", message: getApiErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const rows = await getDepartmentList(false);
      setDepartments(rows.filter((d) => !d.is_deleted));
    } catch (err) {
      setToast({ kind: "error", message: getApiErrorMessage(err) });
    }
  };

  useEffect(() => {
    void fetchUsers();
  }, [showArchived]);

  useEffect(() => {
    void fetchDepartments();
  }, []);

  useEffect(() => {
    setStatusFilter(parseStatusFilter(searchParams.get("status")));
  }, [searchParams]);

  const applyStatusFilter = (value: StatusFilterValue) => {
    setStatusFilter(value);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === "all") next.delete("status");
        else next.set("status", value);
        return next;
      },
      { replace: true },
    );
  };

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

  const mappedUsers: UserRow[] = useMemo(
    () =>
      users.map((u) => ({
        id: u.usersId,
        user_name: u.userName,
        email: u.email || "-",
        dob: u.dateOfBirth || "-",
        status: String(u.status || "PENDING").toUpperCase(),
        department: u.department?.departmentName || "-",
        department_id: Number(
          u.department_department_id ?? u.department?.departmentId ?? 0,
        ),
        active_rental_count: u.activeRentalCount ?? 0,
        is_archived: Boolean(u.isDeleted),
        _actions: "",
      })),
    [users],
  );

  const filtered = useMemo<UserRow[]>(() => {
    let rows = mappedUsers;
    if (statusFilter !== "all") {
      rows = rows.filter((r) => r.status === statusFilter);
    }
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        String(r.user_name).toLowerCase().includes(s) ||
        String(r.email).toLowerCase().includes(s) ||
        String(r.department).toLowerCase().includes(s),
    );
  }, [mappedUsers, q, statusFilter]);

  const filterResetKey = `${q}|${statusFilter}|${showArchived}`;

  useEffect(() => {
    setPage(1);
  }, [q, statusFilter, showArchived]);

  const sortedFiltered = useMemo(
    () => sortRows(filtered, sortKey, sortOrder),
    [filtered, sortKey, sortOrder],
  );

  const totalSorted = sortedFiltered.length;

  const paginatedUsers = useMemo(() => {
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
      : paginatedUsers;

  const rowNumberBase =
    ADMIN_TABLE_DISPLAY_MODE === "infinite"
      ? 0
      : (page - 1) * limit;

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
                applyStatusFilter(value);
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
                  applyStatusFilter("all");
                  setStatusMenuOpen(false);
                }}
              >
                View all users
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
  };

  const startCreate = () => {
    resetForm();
    setOpenForm(true);
  };

  const startView = (row: UserRow) => {
    setSelected(row);
    setOpenView(true);
  };

  const startEdit = (row: UserRow) => {
    setForm({
      userName: row.user_name,
      email: row.email === "-" ? "" : row.email,
      dateOfBirth: row.dob === "-" ? "" : row.dob,
      departmentId: row.department_id || 0,
      password: "",
    });
    setEditingId(row.id);
    setSelected(row);
    setOpenForm(true);
  };

  const startDelete = (row: UserRow) => {
    setSelected(row);
    setOpenDelete(true);
  };

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.departmentId) {
      setToast({ kind: "error", message: "Please select a department." });
      return;
    }

    const payload: UserPayload = {
      userName: form.userName.trim(),
      email: form.email.trim(),
      dateOfBirth: form.dateOfBirth || "",
      departmentId: form.departmentId,
      ...(form.password ? { password: form.password } : {}),
    };

    try {
      setSaving(true);
      if (editingId != null) {
        await updateUser(editingId, payload);
        setToast({ kind: "success", message: "User updated successfully." });
      } else {
        if (!payload.password) {
          setToast({
            kind: "error",
            message: "Password is required for new users.",
          });
          return;
        }
        await createUser(payload);
        setToast({ kind: "success", message: "User created successfully." });
      }
      setOpenForm(false);
      resetForm();
      await fetchUsers();
    } catch (err) {
      setToast({ kind: "error", message: getApiErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!selected) return;
    if (selected.is_archived) {
      setToast({ kind: "warning", message: "This user is already archived." });
      return;
    }
    if (selected.active_rental_count > 0) {
      setToast({
        kind: "warning",
        message: `Cannot archive — ${selected.active_rental_count} active rental(s) still open.`,
      });
      return;
    }
    try {
      setSaving(true);
      await deleteUser(selected.id);
      setToast({ kind: "success", message: "User archived successfully." });
      setOpenDelete(false);
      setSelected(null);
      await fetchUsers();
    } catch (err) {
      setToast({
        kind: isAxiosConflict(err) ? "warning" : "error",
        message: getApiErrorMessage(err),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAccept = async (id: number) => {
    try {
      await acceptUser(id);
      setToast({ kind: "success", message: "User accepted" });
      await fetchUsers();
    } catch (err) {
      setToast({ kind: "error", message: getApiErrorMessage(err) });
    }
  };

  const handleReject = async (id: number) => {
    try {
      await rejectUser(id);
      setToast({ kind: "success", message: "User rejected" });
      await fetchUsers();
    } catch (err) {
      setToast({ kind: "error", message: getApiErrorMessage(err) });
    }
  };

  const columns = [
    { key: "user_name" as const, title: "User Name", sortable: true },
    { key: "email" as const, title: "Email", sortable: true },
    { key: "dob" as const, title: "Date of Birth", sortable: true },
    {
      key: "status" as const,
      title: "Status",
      sortable: true,
      headerCell: statusHeaderMenu,
      render: (row: UserRow) => (
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={
              row.status === "APPROVED"
                ? "font-semibold text-emerald-500"
                : row.status === "REJECTED"
                  ? "font-semibold text-rose-500"
                  : "font-semibold text-yellow-500"
            }
          >
            {row.status}
          </span>
          {row.is_archived && (
            <span className="rounded-md bg-slate-200 px-1.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-600 dark:text-slate-200">
              Archived
            </span>
          )}
        </div>
      ),
    },
    { key: "department" as const, title: "Department", sortable: true },
    {
      key: "active_rental_count" as const,
      title: "Rental Count",
      sortable: true,
      render: (row: UserRow) =>
        row.active_rental_count > 0 ? (
          <span className="font-semibold text-amber-600 dark:text-amber-400">
            {row.active_rental_count} active rental
            {row.active_rental_count === 1 ? "" : "s"}
          </span>
        ) : (
          <span className="text-slate-400 dark:text-slate-500">0</span>
        ),
    },
    {
      key: "_actions" as const,
      title: "Action",
      render: (row: UserRow) => {
        const archiveDisabled = row.is_archived || row.active_rental_count > 0;
        const archiveTooltip = row.is_archived
          ? "User is already archived."
          : row.active_rental_count > 0
            ? `Cannot archive: ${row.active_rental_count} active rental(s).`
            : "Archive user (soft delete)";
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
              text={row.is_archived ? "Cannot edit archived user" : "Edit user"}
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
            {row.status === "PENDING" && !row.is_archived && (
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                onClick={() => void handleAccept(row.id)}
              >
                ✔ Accept
              </button>
            )}
            {row.status === "PENDING" && !row.is_archived && (
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 dark:hover:bg-rose-900/20"
                onClick={() => void handleReject(row.id)}
              >
                ✖ Reject
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users Management"
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
              Add user
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
            placeholder="Search users…"
            className="pl-10"
            aria-label="Search users"
          />
        </div>
      </AdminTableToolbar>

      <motion.div initial={false} animate={{ opacity: 1 }} transition={{ delay: 0.02 }}>
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            Loading users...
          </div>
        ) : (
          <>
            <Table<UserRow>
              columns={columns}
              data={tableRows}
              emptyMessage={sortedFiltered.length === 0 ? "No users found." : undefined}
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
        title={editingId != null ? "Edit user" : "Add user"}
        onClose={() => setOpenForm(false)}
      >
        <form className="space-y-3" onSubmit={onSave}>
          <Input
            name="userName"
            placeholder="User name"
            value={form.userName}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, userName: e.target.value }))
            }
            required
          />
          <Input
            name="email"
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, email: e.target.value }))
            }
            required
          />
          {editingId == null && (
            <Input
              name="password"
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, password: e.target.value }))
              }
              required
            />
          )}
          <DatePicker
            value={form.dateOfBirth}
            onChange={(date) =>
              setForm((prev) => ({ ...prev, dateOfBirth: date }))
            }
            placeholder="Select date of birth"
          />
          <select
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 outline-none transition focus:border-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            value={form.departmentId || ""}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                departmentId: e.target.value ? Number(e.target.value) : 0,
              }))
            }
            required
          >
            <option value="">Select department</option>
            {departments.map((d) => (
              <option key={d.department_id} value={d.department_id}>
                {d.department_name}
              </option>
            ))}
          </select>
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
        title="Archive user"
        onClose={() => setOpenDelete(false)}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-700 dark:text-slate-200">
            Archive <span className="font-semibold">{selected?.user_name}</span>
            ? They will be hidden from lists but rental history stays in the
            system.
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
              onClick={() => void onDelete()}
              disabled={saving}
            >
              {saving ? "Archiving..." : "Archive"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={openView}
        title="User details"
        onClose={() => setOpenView(false)}
      >
        <div className="space-y-3 text-sm text-slate-700 dark:text-slate-200">
          <p>
            <span className="font-semibold">User Name:</span>{" "}
            {selected?.user_name}
          </p>
          <p>
            <span className="font-semibold">Email:</span> {selected?.email}
          </p>
          <p>
            <span className="font-semibold">Date of Birth:</span>{" "}
            {selected?.dob}
          </p>
          <p>
            <span className="font-semibold">Department:</span>{" "}
            {selected?.department}
          </p>
          <p>
            <span className="font-semibold">Status:</span> {selected?.status}
          </p>
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

export default Users;
