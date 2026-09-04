import { Database, Globe, Palette, UserRound } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Modal from "../../components/ui/Modal";
import PageHeader from "../../components/ui/PageHeader";
import ToastBanner from "../../components/ui/ToastBanner";
import { useAuth } from "../../context/AuthContext";
import { useTimezone } from "../../context/TimezoneContext";
import { useTheme } from "../../hooks/useTheme";
import type { AdminTier, BackupFile } from "../../services/api";
import {
  changeAdminPassword,
  createBackup,
  deleteBackupFile,
  downloadBackupFile,
  getAdminProfile,
  getApiErrorMessage,
  listBackups,
  restoreBackupFile,
  restoreBackupUpload,
  updateAdminProfile,
  updateAppTimezone
} from "../../services/api";
import { formatBytes } from "../../utils/datetime";

type Toast = { kind: "success" | "error"; message: string } | null;
type TabId = "account" | "appearance" | "timezone" | "backup";

type ToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
};

const ToggleRow = ({ checked, onChange, label, description }: ToggleProps) => (
  <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200/70 bg-white/60 p-3 dark:border-slate-700 dark:bg-slate-800/50">
    <div>
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</p>
      {description ? <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p> : null}
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition ${
        checked ? "bg-primary" : "bg-slate-300 dark:bg-slate-600"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow transition ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  </div>
);

const cardClass =
  "rounded-2xl border border-slate-200/60 bg-white/80 p-6 shadow-card dark:border-slate-700 dark:bg-slate-800/80 space-y-4";

const tabBtn = (active: boolean) =>
  [
    "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition",
    active
      ? "bg-primary text-white shadow-sm"
      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
  ].join(" ");

const Settings = () => {
  const { theme, setTheme } = useTheme();
  const { isSuperAdmin } = useAuth();
  const tz = useTimezone();
  const [tab, setTab] = useState<TabId>("account");
  const [toast, setToast] = useState<Toast>(null);

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profile, setProfile] = useState<{ userName: string; email: string; role?: AdminTier }>({
    userName: "",
    email: ""
  });

  const [savingPassword, setSavingPassword] = useState(false);
  const [pwd, setPwd] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  const [draftTz, setDraftTz] = useState(tz.timezone);
  const [savingTz, setSavingTz] = useState(false);
  const [previewNow, setPreviewNow] = useState(() => tz.formatClock());

  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [busyBackup, setBusyBackup] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<string | null>(null);
  const [restoreConfirm, setRestoreConfirm] = useState("");
  const [uploadName, setUploadName] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  useEffect(() => {
    setDraftTz(tz.timezone);
  }, [tz.timezone]);

  useEffect(() => {
    const tick = window.setInterval(() => setPreviewNow(tz.formatClock()), 1000);
    return () => window.clearInterval(tick);
  }, [tz]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoadingProfile(true);
        const p = await getAdminProfile();
        if (!cancelled) {
          setProfile({ userName: p.userName || "", email: p.email || "", role: p.role });
        }
      } catch (err) {
        if (!cancelled) setToast({ kind: "error", message: getApiErrorMessage(err) });
      } finally {
        if (!cancelled) setLoadingProfile(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadBackups = async () => {
    if (!isSuperAdmin) return;
    try {
      setLoadingBackups(true);
      setBackups(await listBackups());
    } catch (err) {
      setToast({ kind: "error", message: getApiErrorMessage(err) });
    } finally {
      setLoadingBackups(false);
    }
  };

  useEffect(() => {
    if (tab === "backup" && isSuperAdmin) void loadBackups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, isSuperAdmin]);

  const tabs = useMemo(() => {
    const items: { id: TabId; label: string; icon: typeof UserRound }[] = [
      { id: "account", label: "Account", icon: UserRound },
      { id: "appearance", label: "Appearance", icon: Palette },
      { id: "timezone", label: "Timezone", icon: Globe }
    ];
    if (isSuperAdmin) items.push({ id: "backup", label: "Backup", icon: Database });
    return items;
  }, [isSuperAdmin]);

  const onUpdateProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile.userName.trim()) {
      setToast({ kind: "error", message: "Username is required." });
      return;
    }
    try {
      setSavingProfile(true);
      const updated = await updateAdminProfile({
        userName: profile.userName.trim(),
        email: profile.email.trim()
      });
      setProfile({
        userName: updated.userName || "",
        email: updated.email || "",
        role: updated.role ?? profile.role
      });
      setToast({ kind: "success", message: "Profile updated successfully." });
    } catch (err) {
      setToast({ kind: "error", message: getApiErrorMessage(err) });
    } finally {
      setSavingProfile(false);
    }
  };

  const onUpdatePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (pwd.newPassword.length < 6) {
      setToast({ kind: "error", message: "New password must be at least 6 characters." });
      return;
    }
    if (pwd.newPassword !== pwd.confirmPassword) {
      setToast({ kind: "error", message: "Confirm password does not match." });
      return;
    }
    try {
      setSavingPassword(true);
      await changeAdminPassword({
        currentPassword: pwd.currentPassword,
        newPassword: pwd.newPassword
      });
      setPwd({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setToast({ kind: "success", message: "Password updated successfully." });
    } catch (err) {
      setToast({ kind: "error", message: getApiErrorMessage(err) });
    } finally {
      setSavingPassword(false);
    }
  };

  const onSaveTimezone = async (e: FormEvent) => {
    e.preventDefault();
    try {
      setSavingTz(true);
      const next = await updateAppTimezone(draftTz);
      tz.applySettings(next);
      setToast({ kind: "success", message: "Library timezone updated. Dates and reports now use this zone." });
    } catch (err) {
      setToast({ kind: "error", message: getApiErrorMessage(err) });
    } finally {
      setSavingTz(false);
    }
  };

  const onCreateBackup = async () => {
    try {
      setBusyBackup(true);
      const created = await createBackup();
      setBackups((rows) => [created, ...rows]);
      setToast({ kind: "success", message: `Backup created: ${created.fileName}` });
    } catch (err) {
      setToast({ kind: "error", message: getApiErrorMessage(err) });
    } finally {
      setBusyBackup(false);
    }
  };

  const runRestore = async () => {
    if (restoreConfirm.trim().toUpperCase() !== "RESTORE") {
      setToast({ kind: "error", message: 'Type RESTORE to confirm. This overwrites the live database.' });
      return;
    }
    try {
      setBusyBackup(true);
      if (uploadFile && restoreTarget === "__upload__") {
        await restoreBackupUpload(uploadFile);
      } else if (restoreTarget) {
        await restoreBackupFile(restoreTarget);
      }
      setRestoreTarget(null);
      setRestoreConfirm("");
      setUploadFile(null);
      setUploadName(null);
      await loadBackups();
      await tz.refresh();
      setToast({ kind: "success", message: "Database restored. Sign in again if your session expired." });
    } catch (err) {
      setToast({ kind: "error", message: getApiErrorMessage(err) });
    } finally {
      setBusyBackup(false);
    }
  };

  const previewClock = useMemo(() => {
    try {
      return new Intl.DateTimeFormat("en-GB", {
        timeZone: draftTz,
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      }).format(new Date());
    } catch {
      return previewNow;
    }
  }, [draftTz, previewNow]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Settings" description="Account, appearance, library timezone, and database backups." />

      {toast && <ToastBanner kind={toast.kind} message={toast.message} />}

      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200/70 bg-white/70 p-2 dark:border-slate-700 dark:bg-slate-800/70">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" className={tabBtn(tab === id)} onClick={() => setTab(id)}>
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {tab === "account" && (
        <div className="space-y-6">
          <section className={cardClass}>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Profile</h3>
              {profile.role === "SUPER_ADMIN" && (
                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800 dark:bg-rose-900/50 dark:text-rose-200">
                  Super Admin
                </span>
              )}
              {profile.role === "ADMIN" && (
                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800 dark:bg-sky-900/50 dark:text-sky-200">
                  Admin
                </span>
              )}
            </div>
            <form className="space-y-3" onSubmit={onUpdateProfile}>
              <Input
                placeholder="Username"
                value={profile.userName}
                onChange={(e) => setProfile((p) => ({ ...p, userName: e.target.value }))}
                disabled={loadingProfile}
                required
              />
              <Input
                type="email"
                placeholder="Email"
                value={profile.email}
                onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
                disabled={loadingProfile}
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={savingProfile || loadingProfile}>
                  {savingProfile ? "Updating..." : "Update profile"}
                </Button>
              </div>
            </form>
          </section>

          <section className={cardClass}>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Change password</h3>
            <form className="space-y-3" onSubmit={onUpdatePassword}>
              <Input
                type="password"
                placeholder="Current password"
                value={pwd.currentPassword}
                onChange={(e) => setPwd((p) => ({ ...p, currentPassword: e.target.value }))}
                required
              />
              <Input
                type="password"
                placeholder="New password"
                value={pwd.newPassword}
                onChange={(e) => setPwd((p) => ({ ...p, newPassword: e.target.value }))}
                required
              />
              <Input
                type="password"
                placeholder="Confirm password"
                value={pwd.confirmPassword}
                onChange={(e) => setPwd((p) => ({ ...p, confirmPassword: e.target.value }))}
                required
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={savingPassword}>
                  {savingPassword ? "Updating..." : "Update password"}
                </Button>
              </div>
            </form>
          </section>
        </div>
      )}

      {tab === "appearance" && (
        <section className={cardClass}>
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Theme</h3>
          <ToggleRow
            checked={theme === "dark"}
            onChange={(next) => setTheme(next ? "dark" : "light")}
            label="Dark mode"
            description="Applies to the admin panel on this device."
          />
        </section>
      )}

      {tab === "timezone" && (
        <section className={cardClass}>
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Library timezone</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Used for the live clock, imported timestamps, overdue loans, and dashboard “today / this month”
            windows. Calendar dates such as rent and due dates stay as stored.
          </p>
          <form className="space-y-4" onSubmit={onSaveTimezone}>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
              Timezone
              <select
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 outline-none transition focus:border-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                value={draftTz}
                onChange={(e) => setDraftTz(e.target.value)}
              >
                {(tz.groups.length ? tz.groups : [{ region: "Suggested", zones: [draftTz] }]).map((group) => (
                  <optgroup key={group.region} label={group.region}>
                    {group.zones.map((zone) => (
                      <option key={zone} value={zone}>
                        {zone}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900/50">
              <p className="font-semibold text-slate-800 dark:text-slate-100">{previewClock}</p>
              <p className="mt-1 text-xs text-slate-500">Current offset: {tz.offset || "—"}</p>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={savingTz || draftTz === tz.timezone}>
                {savingTz ? "Saving..." : "Save timezone"}
              </Button>
            </div>
          </form>
        </section>
      )}

      {tab === "backup" && isSuperAdmin && (
        <section className={cardClass}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Database backup</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Super Admin only. Creates a MySQL dump on the server. Restore replaces the live library database.
              </p>
            </div>
            <Button type="button" disabled={busyBackup} onClick={() => void onCreateBackup()}>
              {busyBackup ? "Working..." : "Create backup"}
            </Button>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-100">
            Restoring overwrites all current books, members, and settings. The server needs `mysqldump` / `mysql`
            (mysql-client).
          </div>

          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            Restore from uploaded .sql
            <input
              type="file"
              accept=".sql,application/sql,text/plain"
              className="mt-2 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white dark:text-slate-300"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setUploadFile(file);
                setUploadName(file?.name ?? null);
              }}
            />
          </label>
          {uploadFile && (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="danger"
                disabled={busyBackup}
                onClick={() => {
                  setRestoreTarget("__upload__");
                  setRestoreConfirm("");
                }}
              >
                Restore upload ({uploadName})
              </Button>
            </div>
          )}

          {loadingBackups ? (
            <p className="text-sm text-slate-500">Loading backups…</p>
          ) : backups.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-600">
              No backups yet. Create one before making large catalog changes.
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-2 font-semibold">File</th>
                    <th className="px-3 py-2 font-semibold">Created</th>
                    <th className="px-3 py-2 font-semibold">Size</th>
                    <th className="px-3 py-2 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.map((row) => (
                    <tr key={row.fileName} className="border-t border-slate-200 dark:border-slate-700">
                      <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-100">{row.fileName}</td>
                      <td className="px-3 py-2 text-slate-500">{row.createdAt}</td>
                      <td className="px-3 py-2 text-slate-500">{formatBytes(row.size)}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            className="px-3 py-1 text-xs"
                            onClick={() => void downloadBackupFile(row.fileName)}
                          >
                            Download
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            className="px-3 py-1 text-xs"
                            disabled={busyBackup}
                            onClick={() => {
                              setRestoreTarget(row.fileName);
                              setRestoreConfirm("");
                            }}
                          >
                            Restore
                          </Button>
                          <button
                            type="button"
                            className="text-xs font-semibold text-slate-500 hover:text-rose-600"
                            disabled={busyBackup}
                            onClick={async () => {
                              if (!window.confirm(`Delete ${row.fileName}?`)) return;
                              try {
                                await deleteBackupFile(row.fileName);
                                setBackups((rows) => rows.filter((r) => r.fileName !== row.fileName));
                              } catch (err) {
                                setToast({ kind: "error", message: getApiErrorMessage(err) });
                              }
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <Modal
        open={Boolean(restoreTarget)}
        title="Restore database"
        onClose={() => {
          if (!busyBackup) {
            setRestoreTarget(null);
            setRestoreConfirm("");
          }
        }}
      >
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
          This replaces the live MySQL database
          {restoreTarget === "__upload__" ? " with your uploaded file" : ` with ${restoreTarget}`}. Type{" "}
          <span className="font-semibold">RESTORE</span> to continue.
        </p>
        <Input
          value={restoreConfirm}
          onChange={(e) => setRestoreConfirm(e.target.value)}
          placeholder="RESTORE"
          autoComplete="off"
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" disabled={busyBackup} onClick={() => setRestoreTarget(null)}>
            Cancel
          </Button>
          <Button type="button" variant="danger" disabled={busyBackup} onClick={() => void runRestore()}>
            {busyBackup ? "Restoring..." : "Restore now"}
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default Settings;
