import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import { useTheme } from "../../hooks/useTheme";
import type { AdminTier } from "../../services/api";
import {
  changeAdminPassword,
  getAdminProfile,
  getApiErrorMessage,
  updateAdminProfile
} from "../../services/api";

type Toast = { kind: "success" | "error"; message: string } | null;

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
  "rounded-2xl border border-slate-200/60 bg-white/70 p-6 shadow-lg backdrop-blur-md dark:border-slate-700 dark:bg-slate-800/70 space-y-4";

const Settings = () => {
  const { theme, setTheme } = useTheme();
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

  const [emailNotifications, setEmailNotifications] = useState(true);
  const [systemAlerts, setSystemAlerts] = useState(true);

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

  const onUpdateProfile = async (e: React.FormEvent) => {
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

  const onUpdatePassword = async (e: React.FormEvent) => {
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

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <motion.div initial={false} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Settings</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Manage your admin profile and preferences.</p>
      </motion.div>

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

      <motion.section
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.04 }}
        className={cardClass}
      >
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Profile settings</h3>
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
              {savingProfile ? "Updating..." : "Update Profile"}
            </Button>
          </div>
        </form>
      </motion.section>

      <motion.section
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className={cardClass}
      >
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Change password</h3>
        <form className="space-y-3" onSubmit={onUpdatePassword}>
          <Input
            type="password"
            placeholder="Current Password"
            value={pwd.currentPassword}
            onChange={(e) => setPwd((p) => ({ ...p, currentPassword: e.target.value }))}
            required
          />
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
      </motion.section>

      <motion.section
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className={cardClass}
      >
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">General settings</h3>
        <ToggleRow
          checked={theme === "dark"}
          onChange={(next) => setTheme(next ? "dark" : "light")}
          label="Dark Mode"
          description="Use dark theme in admin panel."
        />
        <ToggleRow
          checked={emailNotifications}
          onChange={setEmailNotifications}
          label="Email Notifications"
          description="UI-only toggle for future notification preferences."
        />
        <ToggleRow
          checked={systemAlerts}
          onChange={setSystemAlerts}
          label="System Alerts"
          description="UI-only toggle for future alert configuration."
        />
      </motion.section>
    </div>
  );
};

export default Settings;

