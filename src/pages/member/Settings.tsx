import axios from "axios";
import { motion } from "framer-motion";
import { FormEvent, useEffect, useState } from "react";
import Button from "../../components/ui/Button";
import DatePicker from "../../components/ui/DatePicker";
import Input from "../../components/ui/Input";
import PageHeader from "../../components/ui/PageHeader";
import ToastBanner from "../../components/ui/ToastBanner";
import { useTimezone } from "../../context/TimezoneContext";
import { useTheme } from "../../hooks/useTheme";
import {
  DepartmentOption,
  UpdateMemberProfilePayload,
  fetchDepartmentsForRegister,
  getApiErrorMessage,
  getCurrentMemberProfile,
  updateMyProfile,
  changeUserPassword
} from "../../services/api";

type Toast = { kind: "success" | "error"; message: string } | null;

const cardClass =
  "rounded-2xl border border-slate-200/60 bg-white/70 p-6 shadow-lg backdrop-blur-md transition hover:shadow-xl dark:border-slate-700 dark:bg-slate-800/70 space-y-4";

const selectClassName =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 outline-none transition focus:border-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white";

const Settings = () => {
  const { theme, setTheme } = useTheme();
  const { timezone, offset, formatClock } = useTimezone();
  const [toast, setToast] = useState<Toast>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [profile, setProfile] = useState({
    userName: "",
    email: "",
    dateOfBirth: "",
    departmentId: 0
  });

  const [pwd, setPwd] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [pwdCurrentError, setPwdCurrentError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingProfile(true);
      setLoadError(null);
      try {
        const [me, depts] = await Promise.all([
          getCurrentMemberProfile(),
          fetchDepartmentsForRegister()
        ]);
        if (cancelled) return;
        setDepartments(depts);
        setProfile({
          userName: me.userName,
          email: me.email,
          dateOfBirth: me.dateOfBirth,
          departmentId: me.departmentId
        });
      } catch (err) {
        if (!cancelled) setLoadError(getApiErrorMessage(err));
      } finally {
        if (!cancelled) setLoadingProfile(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onUpdateProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile.userName.trim()) {
      setToast({ kind: "error", message: "Username is required." });
      return;
    }
    if (!profile.departmentId || profile.departmentId < 1) {
      setToast({ kind: "error", message: "Please select a department." });
      return;
    }

    const payload: UpdateMemberProfilePayload = {
      userName: profile.userName.trim(),
      departmentId: profile.departmentId
    };
    const em = profile.email.trim();
    if (em) payload.email = em;

    const dob = profile.dateOfBirth.trim();
    if (dob) payload.dateOfBirth = dob;

    try {
      setSavingProfile(true);
      const updated = await updateMyProfile(payload);
      setProfile((p) => ({
        ...p,
        userName: updated.userName,
        email: updated.email,
        dateOfBirth: updated.dateOfBirth,
        departmentId: updated.departmentId
      }));
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
      setPwdCurrentError(false);
      await changeUserPassword({
        currentPassword: pwd.currentPassword,
        newPassword: pwd.newPassword
      });
      setPwd({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setPwdCurrentError(false);
      setToast({ kind: "success", message: "Password updated successfully." });
    } catch (err) {
      let message = getApiErrorMessage(err);
      if (axios.isAxiosError(err)) {
        const apiMsg = (err.response?.data as { message?: string } | undefined)?.message;
        if (apiMsg === "Current password is wrong" || apiMsg === "Current password is incorrect") {
          message = "Current password is wrong.";
          setPwdCurrentError(true);
        }
      }
      setToast({ kind: "error", message: message || "Update failed." });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Settings" description="Manage your member account, password, and display preferences." />

      {toast && <ToastBanner kind={toast.kind} message={toast.message} />}

      {loadError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-200">
          {loadError}
        </div>
      )}

      <section className={cardClass}>
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Account settings</h3>
        {loadingProfile ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading your profile…</p>
        ) : (
          <form className="space-y-3" onSubmit={onUpdateProfile}>
            <Input
              placeholder="Username"
              value={profile.userName}
              onChange={(e) => setProfile((p) => ({ ...p, userName: e.target.value }))}
              required
            />
            <Input
              type="email"
              placeholder="Email"
              value={profile.email}
              onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
            />
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Department</label>
              <select
                className={selectClassName}
                value={profile.departmentId > 0 ? String(profile.departmentId) : ""}
                onChange={(e) =>
                  setProfile((p) => ({
                    ...p,
                    departmentId: Number.parseInt(e.target.value, 10) || 0
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
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Date of birth</label>
              <DatePicker
                value={profile.dateOfBirth}
                onChange={(date) => setProfile((p) => ({ ...p, dateOfBirth: date }))}
                placeholder="Select date of birth"
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={savingProfile || !!loadError}>
                {savingProfile ? "Updating..." : "Update Profile"}
              </Button>
            </div>
          </form>
        )}
      </section>

      <section className={cardClass}>
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Change password</h3>
        <form className="space-y-3" onSubmit={onUpdatePassword}>
          <motion.div
            animate={pwdCurrentError ? { x: [0, -6, 6, -6, 6, 0] } : { x: 0 }}
            transition={{ duration: 0.35 }}
          >
            <Input
              type="password"
              placeholder="Current password"
              value={pwd.currentPassword}
              onChange={(e) => {
                setPwdCurrentError(false);
                setPwd((p) => ({ ...p, currentPassword: e.target.value }));
              }}
              className={
                pwdCurrentError
                  ? "border-rose-400 ring-2 ring-rose-200 dark:border-rose-500 dark:ring-rose-900/50"
                  : ""
              }
              required
              aria-invalid={pwdCurrentError}
            />
          </motion.div>
          <Input
            type="password"
            placeholder="New Password"
            value={pwd.newPassword}
            onChange={(e) => setPwd((p) => ({ ...p, newPassword: e.target.value }))}
            required
          />
          <Input
            type="password"
            placeholder="Confirm Password"
            value={pwd.confirmPassword}
            onChange={(e) => setPwd((p) => ({ ...p, confirmPassword: e.target.value }))}
            required
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={savingPassword}>
              {savingPassword ? "Updating..." : "Update Password"}
            </Button>
          </div>
        </form>
      </section>

      <section className={cardClass}>
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Appearance</h3>
        <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200/70 bg-white/60 p-3 dark:border-slate-700 dark:bg-slate-800/50">
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Dark mode</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Applies on this device.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={theme === "dark"}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition ${
              theme === "dark" ? "bg-primary" : "bg-slate-300 dark:bg-slate-600"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow transition ${
                theme === "dark" ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </section>

      <section className={cardClass}>
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Library timezone</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Dates and times in the library use the timezone set by administrators.
        </p>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900/50">
          <p className="font-semibold text-slate-800 dark:text-slate-100">{timezone}</p>
          <p className="mt-1 text-xs text-slate-500">
            {offset || "—"} · {formatClock()}
          </p>
        </div>
      </section>
    </div>
  );
};

export default Settings;
