import { motion } from "framer-motion";
import { ChevronDown, Eye, Pencil, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import Button from "../../components/ui/Button";
import DatePicker from "../../components/ui/DatePicker";
import Input from "../../components/ui/Input";
import Modal from "../../components/ui/Modal";
import SearchableSelect from "../../components/ui/SearchableSelect";
import AdminTableToolbar from "../../components/ui/AdminTableToolbar";
import TableInfiniteFooter from "../../components/ui/TableInfiniteFooter";
import TablePagination from "../../components/ui/TablePagination";
import { Table } from "../../components/ui/Table";
import { useAdminTableInfiniteScroll } from "../../components/ui/useAdminTableInfiniteScroll";
import { ADMIN_TABLE_DISPLAY_MODE } from "../../config/adminTableMode";
import { sortRows } from "../../utils/tableSort";
import {
  BookItem,
  createRent,
  deleteRent,
  getApiErrorMessage,
  getBooks,
  getRentList,
  getUsers,
  RentItem,
  RentPayload,
  returnRentBook,
  updateRent,
  UserItem
} from "../../services/api";

type RentRow = Record<string, unknown> & {
  id: number;
  book: string;
  user: string;
  rent_date: string;
  due_date: string;
  return_date: string;
  status: string;
};

type Toast = { kind: "success" | "error"; message: string } | null;

type RentStatusFilterValue = "all" | "Active" | "Overdue" | "Returned";

const RENT_STATUS_FILTER_OPTIONS: { value: Exclude<RentStatusFilterValue, "all">; label: string }[] = [
  { value: "Active", label: "Active" },
  { value: "Overdue", label: "Overdue" },
  { value: "Returned", label: "Returned" }
];

const actionClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700";

const emptyForm = {
  book_id: 0,
  user_id: 0,
  rent_date: "",
  due_date: "",
  return_date: ""
};

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

function loanStatus(dueYmd: string, returned: boolean): string {
  if (returned) return "Returned";
  if (!dueYmd || dueYmd === "-") return "Active";
  if (dueYmd < todayYmd()) return "Overdue";
  return "Active";
}

const RentList = () => {
  const [rentRows, setRentRows] = useState<RentItem[]>([]);
  const [books, setBooks] = useState<BookItem[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<RentStatusFilterValue>("all");
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const statusHeaderRef = useRef<HTMLDivElement>(null);
  const [openForm, setOpenForm] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const [openView, setOpenView] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selected, setSelected] = useState<RentRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [toast, setToast] = useState<Toast>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const hydrateRows = (list: RentItem[]): RentRow[] =>
    list.map((r) => {
      const returned = r.return_date != null && r.return_date !== "";
      return {
        id: r.rent_list_id,
        book: r.book_name?.trim() ? r.book_name : `Book #${r.Books_book_id}`,
        user: r.user_name?.trim() ? r.user_name : `User #${r.Users_users_id}`,
        rent_date: r.rent_date || "-",
        due_date: r.due_date || "-",
        return_date: returned ? r.return_date! : "-",
        status: loanStatus(r.due_date || "", returned)
      };
    });

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [rentList, bookList, userList] = await Promise.all([getRentList(), getBooks(), getUsers()]);
      setRentRows(rentList);
      setBooks(bookList);
      setUsers(userList);
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

  const mappedRows = useMemo(() => hydrateRows(rentRows), [rentRows]);

  const filtered = useMemo(() => {
    let rows = mappedRows;
    if (statusFilter !== "all") {
      rows = rows.filter((r) => r.status === statusFilter);
    }
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        String(r.book).toLowerCase().includes(s) ||
        String(r.user).toLowerCase().includes(s) ||
        String(r.rent_date).toLowerCase().includes(s) ||
        String(r.due_date).toLowerCase().includes(s) ||
        String(r.return_date).toLowerCase().includes(s) ||
        String(r.status).toLowerCase().includes(s)
    );
  }, [mappedRows, q, statusFilter]);

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

  const tableRows =
    ADMIN_TABLE_DISPLAY_MODE === "infinite"
      ? infiniteScroll.visibleSlice
      : paginatedRows;

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
        aria-label="Filter by rental status"
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
          {RENT_STATUS_FILTER_OPTIONS.map(({ value, label }) => (
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
                View all rentals
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

  const startView = (row: RentRow) => {
    setSelected(row);
    setOpenView(true);
  };

  const startEdit = (row: RentRow) => {
    const raw = rentRows.find((r) => r.rent_list_id === row.id);
    if (!raw) return;
    setForm({
      book_id: raw.Books_book_id,
      user_id: raw.Users_users_id,
      rent_date: raw.rent_date || "",
      due_date: raw.due_date || "",
      return_date: raw.return_date ?? ""
    });
    setEditingId(row.id);
    setOpenForm(true);
  };

  const startDelete = (row: RentRow) => {
    setSelected(row);
    setOpenDelete(true);
  };

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.book_id || !form.user_id) {
      setToast({ kind: "error", message: "Please select a book and a user." });
      return;
    }
    if (!form.rent_date || !form.due_date) {
      setToast({ kind: "error", message: "Rent date and due date are required." });
      return;
    }

    const payload: RentPayload = {
      bookId: form.book_id,
      usersId: form.user_id,
      rentDate: form.rent_date,
      dueDate: form.due_date,
      returnDate: form.return_date.trim() ? form.return_date.trim() : null
    };

    try {
      setSaving(true);
      if (editingId) {
        await updateRent(editingId, payload);
        setToast({ kind: "success", message: "Rental updated successfully." });
      } else {
        await createRent({
          bookId: payload.bookId,
          usersId: payload.usersId,
          rentDate: payload.rentDate,
          dueDate: payload.dueDate
        });
        setToast({ kind: "success", message: "Rental created successfully." });
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
      await deleteRent(selected.id);
      setToast({ kind: "success", message: "Rental deleted successfully." });
      setOpenDelete(false);
      setSelected(null);
      await fetchAll();
    } catch (err) {
      setToast({ kind: "error", message: getApiErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const handleQuickReturn = async (id: number) => {
    try {
      setSaving(true);
      await returnRentBook(id);
      setToast({ kind: "success", message: "Book marked as returned." });
      await fetchAll();
    } catch (err) {
      setToast({ kind: "error", message: getApiErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const statusClass = (status: string) => {
    if (status === "Returned") return "font-semibold text-emerald-600 dark:text-emerald-400";
    if (status === "Overdue") return "font-semibold text-rose-600 dark:text-rose-400";
    return "font-semibold text-amber-600 dark:text-amber-400";
  };

  const columns = [
    { key: "book" as const, title: "Book", sortable: true },
    { key: "user" as const, title: "User", sortable: true },
    { key: "rent_date" as const, title: "Rent Date", sortable: true },
    { key: "due_date" as const, title: "Due Date", sortable: true },
    { key: "return_date" as const, title: "Return Date", sortable: true },
    {
      key: "status" as const,
      title: "Status",
      sortable: true,
      headerCell: statusHeaderMenu,
      render: (row: RentRow) => <span className={statusClass(row.status)}>{row.status}</span>
    },
    {
      key: "id" as const,
      title: "Actions",
      render: (row: RentRow) => (
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
          {row.status !== "Returned" && (
            <button
              type="button"
              className={`${actionClass} text-emerald-600`}
              title="Mark returned (today)"
              disabled={saving}
              onClick={() => void handleQuickReturn(row.id)}
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <motion.div initial={false} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Rent List</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">Loans, due dates, and returns.</p>
        </motion.div>
        <Button type="button" className="inline-flex items-center gap-2 self-start" onClick={startCreate}>
          <Plus className="h-4 w-4" />
          Add rental
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
            placeholder="Search rentals…"
            className="pl-10"
            aria-label="Search rentals"
          />
        </div>
      </AdminTableToolbar>

      <motion.div initial={false} animate={{ opacity: 1 }} transition={{ delay: 0.02 }}>
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            Loading rentals...
          </div>
        ) : (
          <>
            <Table<RentRow>
              columns={columns}
              data={tableRows}
              emptyMessage={sortedFiltered.length === 0 ? "No rentals found." : undefined}
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

      <Modal open={openForm} title={editingId ? "Edit rental" : "Add rental"} onClose={() => setOpenForm(false)}>
        <form className="space-y-3" onSubmit={onSave}>
          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Book
            </label>
            <SearchableSelect
              options={books.map((b) => ({ value: b.book_id, label: b.book_name }))}
              value={form.book_id || 0}
              onValueChange={(v) => setForm((p) => ({ ...p, book_id: v }))}
              placeholder="Select book"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              User
            </label>
            <SearchableSelect
              options={users.map((u) => ({ value: u.usersId, label: u.userName }))}
              value={form.user_id || 0}
              onValueChange={(v) => setForm((p) => ({ ...p, user_id: v }))}
              placeholder="Select user"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Rent date
            </label>
            <DatePicker
              value={form.rent_date}
              onChange={(date) => setForm((p) => ({ ...p, rent_date: date }))}
              placeholder="Select rent date"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Due date
            </label>
            <DatePicker
              value={form.due_date}
              onChange={(date) => setForm((p) => ({ ...p, due_date: date }))}
              placeholder="Select due date"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Return date <span className="font-normal normal-case text-slate-400">(optional)</span>
            </label>
            <DatePicker
              value={form.return_date}
              onChange={(date) => setForm((p) => ({ ...p, return_date: date }))}
              placeholder="Not returned yet"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Leave empty if still out. Use the row action to set return to today.
            </p>
          </div>
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

      <Modal open={openDelete} title="Delete rental" onClose={() => setOpenDelete(false)}>
        <div className="space-y-4">
          <p className="text-sm text-slate-700 dark:text-slate-200">
            Remove rental for <span className="font-semibold">{selected?.book}</span> —{" "}
            <span className="font-semibold">{selected?.user}</span>?
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpenDelete(false)}>
              Cancel
            </Button>
            <Button type="button" variant="danger" onClick={() => void onDelete()} disabled={saving}>
              {saving ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={openView} title="Rental details" onClose={() => setOpenView(false)}>
        <div className="space-y-3 text-sm text-slate-700 dark:text-slate-200">
          <p>
            <span className="font-semibold">Book:</span> {selected?.book}
          </p>
          <p>
            <span className="font-semibold">User:</span> {selected?.user}
          </p>
          <p>
            <span className="font-semibold">Rent date:</span> {selected?.rent_date}
          </p>
          <p>
            <span className="font-semibold">Due date:</span> {selected?.due_date}
          </p>
          <p>
            <span className="font-semibold">Return date:</span> {selected?.return_date}
          </p>
          <p>
            <span className="font-semibold">Status:</span>{" "}
            {selected ? <span className={statusClass(selected.status)}>{selected.status}</span> : "—"}
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

export default RentList;
