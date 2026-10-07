import { motion } from "framer-motion";
import { Activity, RefreshCw, UserCheck, UserX, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import Button from "../../components/ui/Button";
import PageHeader from "../../components/ui/PageHeader";
import {
  getApiErrorMessage,
  getClosedTestingOverview,
  type ClosedTestingOverview
} from "../../services/api";

const glassPanel =
  "rounded-2xl border border-slate-200/60 bg-white/70 p-5 shadow-lg backdrop-blur-md dark:border-slate-600/50 dark:bg-slate-800/70";

const POLL_MS = 30000;

function StatCard({
  label,
  value,
  icon: Icon,
  hint
}: {
  label: string;
  value: number;
  icon: typeof Users;
  hint?: string;
}) {
  return (
    <div className={glassPanel}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {label}
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-800 dark:text-white">{value}</p>
          {hint ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p> : null}
        </div>
        <div className="rounded-xl bg-sky-50 p-2.5 text-sky-700 dark:bg-sky-900/40 dark:text-sky-200">
          <Icon className="h-5 w-5" aria-hidden />
        </div>
      </div>
    </div>
  );
}

const ClosedTesting = () => {
  const [data, setData] = useState<ClosedTestingOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const overview = await getClosedTestingOverview(14);
      setData(overview);
      setError(null);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => {
      void load(true);
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  const chartMax = Math.max(4, ...(data?.daily.map((d) => d.active) ?? [0]));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Closed Testing"
        description="Daily active testers over the last 14 days (admin only). Chart uses short names; emails are in the table."
        actions={
          <Button
            type="button"
            variant="secondary"
            onClick={() => void load(true)}
            disabled={refreshing || loading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Invited"
          value={data?.summary.invited ?? 0}
          icon={Users}
          hint="Closed test list"
        />
        <StatCard
          label="Active today"
          value={data?.summary.activeToday ?? 0}
          icon={Activity}
          hint={data?.today ? `Timezone: ${data.timezone}` : undefined}
        />
        <StatCard
          label="Active (14 days)"
          value={data?.summary.activeInWindow ?? 0}
          icon={UserCheck}
          hint="At least one day in window"
        />
        <StatCard
          label="Inactive"
          value={data?.summary.inactive ?? 0}
          icon={UserX}
          hint="No activity in 14 days"
        />
      </div>

      <motion.div
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        className={`${glassPanel} space-y-3`}
      >
        <div>
          <h3 className="text-base font-semibold text-slate-800 dark:text-white">
            Daily active testers
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            How many testers opened the app each day
          </p>
        </div>
        {loading && !data ? (
          <div className="h-[280px] animate-pulse rounded-xl bg-slate-200/80 dark:bg-slate-700/50" />
        ) : (
          <div className="h-[280px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data?.daily ?? []} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="ctFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  className="stroke-slate-200 dark:stroke-slate-600"
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  width={32}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, chartMax]}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid rgb(226 232 240)",
                    background: "rgba(255,255,255,0.95)"
                  }}
                  formatter={(v) => [Number(v ?? 0), "Active testers"]}
                  labelFormatter={(label) => String(label)}
                />
                <Area
                  type="monotone"
                  dataKey="active"
                  stroke="transparent"
                  fill="url(#ctFill)"
                  animationDuration={600}
                />
                <Line
                  type="monotone"
                  dataKey="active"
                  stroke="#0284c7"
                  strokeWidth={2}
                  animationDuration={600}
                  dot={{ r: 3, fill: "#0284c7", strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </motion.div>

      <div className={`${glassPanel} overflow-x-auto`}>
        <div className="mb-3">
          <h3 className="text-base font-semibold text-slate-800 dark:text-white">Testers</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Short name on chart labels · email in this table · ● = active that day
          </p>
        </div>
        <table className="min-w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-600 dark:text-slate-400">
              <th className="sticky left-0 z-10 bg-white/95 px-3 py-2 dark:bg-slate-800/95">Name</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Today</th>
              <th className="px-3 py-2">Last active</th>
              {(data?.dayLabels ?? []).map((label) => (
                <th key={label} className="px-1.5 py-2 text-center font-medium normal-case">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && !data ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-slate-500">
                  Loading testers…
                </td>
              </tr>
            ) : null}
            {(data?.testers ?? []).map((t) => (
              <tr
                key={t.id}
                className="border-b border-slate-100 dark:border-slate-700/60"
              >
                <td className="sticky left-0 z-10 bg-white/95 px-3 py-2 font-semibold text-slate-800 dark:bg-slate-800/95 dark:text-slate-100">
                  {t.shortName}
                </td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{t.email}</td>
                <td className="px-3 py-2">
                  <span
                    className={
                      t.activeToday
                        ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200"
                        : "rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-300"
                    }
                  >
                    {t.activeToday ? "Active" : "—"}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-500 dark:text-slate-400">
                  {t.lastActiveLabel ?? "—"}
                </td>
                {t.days.map((on, i) => (
                  <td key={`${t.id}-${i}`} className="px-1.5 py-2 text-center">
                    <span
                      className={
                        on
                          ? "inline-block h-2.5 w-2.5 rounded-full bg-sky-500"
                          : "inline-block h-2.5 w-2.5 rounded-full bg-slate-200 dark:bg-slate-600"
                      }
                      title={on ? "Active" : "Inactive"}
                    />
                  </td>
                ))}
              </tr>
            ))}
            {!loading && data && data.testers.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-slate-500">
                  No testers seeded yet. Run the closed-testers migration and seeder.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ClosedTesting;
