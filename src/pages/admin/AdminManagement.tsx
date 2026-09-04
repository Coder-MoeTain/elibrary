import { motion } from "framer-motion";
import { Plus, Trash2, User } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Modal from "../../components/ui/Modal";
import { Table } from "../../components/ui/Table";
import PageHeader from "../../components/ui/PageHeader";
import Tooltip from "../../components/ui/Tooltip";
import {
  AdminAccount,
  AdminTier,
  createAdminAccount,
  deleteAdminAccount,
  getApiErrorMessage,
  listAdminAccounts,
  readAdminIdFromToken,
  updateAdminAccount
} from "../../services/api";

type Toast = { kind: "success" | "error"; message: string } | null;

type AdminRow = AdminAccount & { email: string; _actions: string };

const actionClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700";

function RoleBadge({ role }: { role: AdminTier }) {
  if (role === "SUPER_ADMIN") {
    return (
      <span className="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-800 dark:bg-rose-900/50 dark:text-rose-200">
        Super Admin
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-800 dark:bg-sky-900/50 dark:text-sky-200">
      Admin
    </span>
  );
}

const AdminManagement = () => {
  const [rows, setRows] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [openAdd, setOpenAdd] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AdminAccount | null>(null);
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<AdminTier>("ADMIN");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const list = await listAdminAccounts();
      setRows(list);
    } catch (err) {
      setToast({ kind: "error", message: getApiErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onRoleChange = async (row: AdminAccount, next: AdminTier) => {
    if (next === row.role) return;
    try {
      setSaving(true);
      await updateAdminAccount(row.adminId, { role: next });
      setToast({ kind: "success", message: "Role updated." });
      await load();
    } catch (err) {
      setToast({ kind: "error", message: getApiErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const selfId = readAdminIdFromToken();

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name || newPassword.length < 6) {
      setToast({ kind: "error", message: "Name and password (min 6 chars) are required." });
      return;
    }
    try {
      setSaving(true);
      await createAdminAccount({
        adminName: name,
        password: newPassword,
        role: newRole
      });
      setToast({ kind: "success", message: "Admin created." });
      setOpenAdd(false);
      setNewName("");
      setNewPassword("");
      setNewRole("ADMIN");
      await load();
    } catch (err) {
      setToast({ kind: "error", message: getApiErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      setSaving(true);
      await deleteAdminAccount(pendingDelete.adminId);
      setToast({ kind: "success", message: "Admin removed." });
      setOpenDelete(false);
      setPendingDelete(null);
      await load();
    } catch (err) {
      setToast({ kind: "error", message: getApiErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const columns: {
    key: keyof AdminRow;
    title: string;
    render?: (row: AdminRow) => ReactNode;
  }[] = [
    { key: "adminId", title: "No" },
    { key: "adminName", title: "Name" },
    {
      key: "email",
      title: "Email",
      render: () => <span className="text-slate-400">—</span>
    },
    {
      key: "role",
      title: "Role",
      render: (row: AdminRow) => <RoleBadge role={row.role} />
    },
    {
      key: "_actions",
      title: "Actions",
      render: (row: AdminRow) => {
        const isSelf = selfId != null && row.adminId === selfId;
        const deleteDisabled = isSelf;
        return (
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              value={row.role}
              disabled={saving || isSelf}
              title={isSelf ? "Change role from another Super Admin account" : "Change role"}
              onChange={(e) => void onRoleChange(row, e.target.value as AdminTier)}
            >
              <option value="ADMIN">Admin</option>
              <option value="SUPER_ADMIN">Super Admin</option>
            </select>
            <Tooltip
              text={
                deleteDisabled
                  ? "You cannot delete your own account."
                  : "Delete admin (cannot be undone)"
              }
            >
              <span className="inline-flex">
                <button
                  type="button"
                  className={actionClass}
                  disabled={deleteDisabled || saving}
                  title="Delete"
                  onClick={() => {
                    if (deleteDisabled) return;
                    setPendingDelete(row);
                    setOpenDelete(true);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-rose-500" />
                </button>
              </span>
            </Tooltip>
          </div>
        );
      }
    }
  ];

  const tableData: AdminRow[] = rows.map((r) => ({
    ...r,
    email: "",
    _actions: ""
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Management"
        description="Super Admins only — create admins, assign roles, and remove accounts."
        actions={
          <Button type="button" className="inline-flex items-center gap-2" onClick={() => setOpenAdd(true)}>
            <Plus className="h-4 w-4" />
            Add admin
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

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          Loading admins…
        </div>
      ) : (
        <Table<AdminRow> columns={columns} data={tableData} rowNumberBase={0} />
      )}

      <Modal open={openAdd} title="Add admin" onClose={() => setOpenAdd(false)}>
        <form className="space-y-3" onSubmit={(e) => void onAdd(e)}>
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <User className="h-4 w-4 shrink-0" aria-hidden />
            <span>New account defaults to the selected role.</span>
          </div>
          <Input
            placeholder="Admin username"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
            autoComplete="off"
          />
          <Input
            type="password"
            placeholder="Password (min 6 characters)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Role
            <select
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as AdminTier)}
            >
              <option value="ADMIN">Admin</option>
              <option value="SUPER_ADMIN">Super Admin</option>
            </select>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpenAdd(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Create"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={openDelete} title="Delete admin" onClose={() => setOpenDelete(false)}>
        <div className="space-y-4">
          <p className="text-sm text-slate-700 dark:text-slate-200">
            Are you sure you want to remove{" "}
            <span className="font-semibold">{pendingDelete?.adminName}</span>? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpenDelete(false)}>
              Cancel
            </Button>
            <Button type="button" variant="danger" onClick={() => void confirmDelete()} disabled={saving}>
              {saving ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminManagement;
