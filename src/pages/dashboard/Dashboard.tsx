import { motion } from "framer-motion";
import { BookMarked, BookOpen, ClipboardList, FileDown, Smartphone, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../components/ui/Card";
import PageHeader from "../../components/ui/PageHeader";
import ToastBanner from "../../components/ui/ToastBanner";
import { useAnimatedNumber } from "../../hooks/useAnimatedNumber";
import {
  getApiErrorMessage,
  getAppSettings,
  getDashboardStats,
  updateEbooksEnabled
} from "../../services/api";
import DashboardAnalytics from "./DashboardAnalytics";

type StatDef = {
  statKey: "totalBooks" | "totalEbooks" | "importedPapers" | "totalUsers" | "monthlyRentals";
  label: string;
  icon: typeof BookOpen;
  accent: string;
  bg: string;
  to: string;
};

type Toast = { kind: "success" | "error"; message: string } | null;

const statDefs: StatDef[] = [
  {
    statKey: "totalBooks",
    label: "Total Books",
    icon: BookOpen,
    accent: "text-sky-600",
    bg: "bg-sky-50 dark:bg-sky-950/50",
    to: "/admin/books"
  },
  {
    statKey: "totalEbooks",
    label: "e-Books",
    icon: BookMarked,
    accent: "text-violet-600",
    bg: "bg-violet-50 dark:bg-violet-950/40",
    to: "/admin/ebooks"
  },
  {
    statKey: "importedPapers",
    label: "Imported papers",
    icon: FileDown,
    accent: "text-indigo-600",
    bg: "bg-indigo-50 dark:bg-indigo-950/40",
    to: "/admin/imports"
  },
  {
    statKey: "totalUsers",
    label: "Active Members",
    icon: Users,
    accent: "text-emerald-600",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    to: "/admin/users"
  },
  {
    statKey: "monthlyRentals",
    label: "Rentals (month)",
    icon: ClipboardList,
    accent: "text-amber-600",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    to: "/admin/rent"
  }
];

const StatTile = ({ label, value, icon: Icon, accent, bg, index, to }: StatDef & { value: number; index: number }) => {
  const navigate = useNavigate();
  const display = useAnimatedNumber(value);
  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.35, ease: "easeOut" }}
    >
      <Card
        role="button"
        tabIndex={0}
        whileHover={{ scale: 1.05 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className="flex cursor-pointer items-center gap-4 transition-transform outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
        onClick={() => navigate(to)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            navigate(to);
          }
        }}
      >
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${bg}`}>
          <Icon className={`h-6 w-6 ${accent}`} aria-hidden />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
          <p className="text-2xl font-bold text-slate-800 dark:text-white">{display}</p>
        </div>
      </Card>
    </motion.div>
  );
};

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalBooks: 0,
    totalEbooks: 0,
    importedPapers: 0,
    totalUsers: 0,
    monthlyRentals: 0
  });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ebooksEnabled, setEbooksEnabled] = useState(false);
  const [loadingEbooksFlag, setLoadingEbooksFlag] = useState(true);
  const [savingEbooksFlag, setSavingEbooksFlag] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoadError(null);
        const res = await getDashboardStats();
        if (!cancelled) setStats(res);
      } catch (err) {
        if (!cancelled) setLoadError(getApiErrorMessage(err));
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoadingEbooksFlag(true);
        const settings = await getAppSettings();
        if (!cancelled) setEbooksEnabled(settings.ebooksEnabled);
      } catch (err) {
        if (!cancelled) {
          setToast({ kind: "error", message: getApiErrorMessage(err) });
        }
      } finally {
        if (!cancelled) setLoadingEbooksFlag(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const onToggleEbooksEnabled = async (next: boolean) => {
    try {
      setSavingEbooksFlag(true);
      const settings = await updateEbooksEnabled(next);
      setEbooksEnabled(settings.ebooksEnabled);
      setToast({
        kind: "success",
        message: settings.ebooksEnabled
          ? "Mobile app will show the current E-Books UI."
          : "Mobile app will show E-Books as Coming Soon."
      });
    } catch (err) {
      setToast({ kind: "error", message: getApiErrorMessage(err) });
    } finally {
      setSavingEbooksFlag(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Catalog totals, imported papers, and activity for the current library timezone."
      />
      {toast ? <ToastBanner kind={toast.kind} message={toast.message} /> : null}
      {loadError ? (
        <p className="text-sm text-rose-600 dark:text-rose-400" role="alert">
          {loadError}
        </p>
      ) : null}

      <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-50 dark:bg-violet-950/40">
            <Smartphone className="h-6 w-6 text-violet-600" aria-hidden />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
              Mobile E-Books
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {loadingEbooksFlag || savingEbooksFlag
                ? "Updating…"
                : ebooksEnabled
                  ? "On — members see the normal E-Books catalog, reader, and downloads."
                  : "Off — members see Coming Soon instead of the E-Books catalog."}
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={ebooksEnabled}
          aria-label="Show E-Books in mobile app"
          disabled={loadingEbooksFlag || savingEbooksFlag}
          onClick={() => onToggleEbooksEnabled(!ebooksEnabled)}
          className={`relative inline-flex h-7 w-12 shrink-0 rounded-full transition disabled:opacity-60 ${
            ebooksEnabled ? "bg-primary" : "bg-slate-300 dark:bg-slate-600"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-6 w-6 translate-y-0.5 rounded-full bg-white shadow transition ${
              ebooksEnabled ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {statDefs.map((s, index) => (
          <StatTile key={s.statKey} {...s} value={stats[s.statKey]} index={index} />
        ))}
      </div>

      <DashboardAnalytics />
    </div>
  );
};

export default Dashboard;
