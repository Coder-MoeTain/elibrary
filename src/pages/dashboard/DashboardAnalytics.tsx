import { motion } from "framer-motion";
import { AlertTriangle, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  getApiErrorMessage,
  getDashboardAnalytics,
  type CategoryDistributionItem,
  type MonthlySeriesPoint,
  type OverdueRentalItem,
  type PopularBookItem,
  type PopularEbookItem
} from "../../services/api";

const glassPanel =
  "rounded-2xl border border-slate-200/60 bg-white/70 p-5 shadow-lg backdrop-blur-md transition hover:shadow-xl dark:border-slate-600/50 dark:bg-slate-800/70";

const PIE_COLORS = [
  "#0ea5e9",
  "#8b5cf6",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#6366f1",
  "#14b8a6",
  "#f97316"
];

type LoadState<T> = { loading: true } | { loading: false; data: T; error?: string };

const panelMotion = {
  initial: false as const,
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: "easeOut" as const }
};

function ChartSkeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-slate-200/90 dark:bg-slate-700/50 ${className}`}
      aria-hidden
    />
  );
}

function ChartEmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex h-[280px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 text-center dark:border-slate-600 dark:bg-slate-900/40">
      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{title}</p>
      <p className="max-w-md text-xs text-slate-500 dark:text-slate-400">{hint}</p>
    </div>
  );
}

function PanelShell({
  title,
  subtitle,
  children,
  className = "",
  delay = 0
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      {...panelMotion}
      transition={{ ...panelMotion.transition, delay }}
      whileHover={{ scale: 1.02 }}
      className={`${glassPanel} ${className}`}
    >
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-white">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
      </div>
      {children}
    </motion.div>
  );
}

const DashboardAnalytics = () => {
  const [rentalsMonthly, setRentalsMonthly] = useState<LoadState<MonthlySeriesPoint[]>>({ loading: true });
  const [categories, setCategories] = useState<LoadState<CategoryDistributionItem[]>>({ loading: true });
  const [ebooksCategories, setEbooksCategories] = useState<LoadState<CategoryDistributionItem[]>>({ loading: true });
  const [popular, setPopular] = useState<LoadState<PopularBookItem[]>>({ loading: true });
  const [popularEbooks, setPopularEbooks] = useState<LoadState<PopularEbookItem[]>>({ loading: true });
  const [overdue, setOverdue] = useState<LoadState<OverdueRentalItem[]>>({ loading: true });
  const [userGrowth, setUserGrowth] = useState<LoadState<MonthlySeriesPoint[]>>({ loading: true });

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const bundle = await getDashboardAnalytics();
        if (cancelled) return;
        setRentalsMonthly({ loading: false, data: bundle.monthlyRentals });
        setCategories({ loading: false, data: bundle.categories });
        setEbooksCategories({ loading: false, data: bundle.ebooksCategories });
        setPopular({ loading: false, data: bundle.popularBooks });
        setPopularEbooks({ loading: false, data: bundle.popularEbooks });
        setOverdue({ loading: false, data: bundle.overdue });
        setUserGrowth({ loading: false, data: bundle.userGrowth });
      } catch (e) {
        const msg = getApiErrorMessage(e);
        if (cancelled) return;
        setRentalsMonthly({ loading: false, data: [], error: msg });
        setCategories({ loading: false, data: [], error: msg });
        setEbooksCategories({ loading: false, data: [], error: msg });
        setPopular({ loading: false, data: [], error: msg });
        setPopularEbooks({ loading: false, data: [], error: msg });
        setOverdue({ loading: false, data: [], error: msg });
        setUserGrowth({ loading: false, data: [], error: msg });
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const maxRentCount = useMemo(() => {
    if (popular.loading || !popular.data.length) return 1;
    return Math.max(...popular.data.map((b) => b.rent_count), 1);
  }, [popular]);

  const maxEbookReadCount = useMemo(() => {
    if (popularEbooks.loading || !popularEbooks.data.length) return 1;
    return Math.max(...popularEbooks.data.map((b) => b.read_count), 1);
  }, [popularEbooks]);

  const categoryTotal = useMemo(() => {
    if (categories.loading) return 0;
    return categories.data.reduce((s, c) => s + c.value, 0) || 1;
  }, [categories]);

  const ebooksCategoryTotal = useMemo(() => {
    if (ebooksCategories.loading) return 0;
    return ebooksCategories.data.reduce((s, c) => s + c.value, 0) || 1;
  }, [ebooksCategories]);

  const rentalSeriesMax = useMemo(() => {
    if (rentalsMonthly.loading || !rentalsMonthly.data.length) return 0;
    return Math.max(...rentalsMonthly.data.map((p) => p.total), 0);
  }, [rentalsMonthly]);

  const userGrowthMax = useMemo(() => {
    if (userGrowth.loading || !userGrowth.data.length) return 0;
    return Math.max(...userGrowth.data.map((p) => p.total), 0);
  }, [userGrowth]);

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
      {/* Monthly rentals — line / area */}
      <PanelShell
        title="Monthly rentals"
        subtitle="Rental volume over the last 12 months"
        className="xl:col-span-2"
        delay={0}
      >
        {rentalsMonthly.loading ? (
          <ChartSkeleton className="h-[280px] w-full" />
        ) : rentalsMonthly.error && !rentalsMonthly.data.length ? (
          <p className="text-sm text-rose-600 dark:text-rose-400">{rentalsMonthly.error}</p>
        ) : !rentalsMonthly.data.length ? (
          <ChartEmptyState
            title="No chart data loaded"
            hint="The API did not return a 12‑month series (often means /dashboard/summary is missing analytics or granular routes failed). Restart the API after pulling latest code, then check DevTools → Network → GET /api/dashboard/summary for an analytics object."
          />
        ) : (
          <motion.div
            initial={false}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35 }}
            className="h-[280px] w-full min-w-0"
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={rentalsMonthly.data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="rentFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-slate-200 dark:stroke-slate-600" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  width={32}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, Math.max(4, rentalSeriesMax + 1)]}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid rgb(226 232 240)",
                    background: "rgba(255,255,255,0.95)"
                  }}
                  formatter={(v) => [Number(v ?? 0), "Rentals"]}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="transparent"
                  fill="url(#rentFill)"
                  animationDuration={600}
                  isAnimationActive
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="#0284c7"
                  strokeWidth={2}
                  animationDuration={600}
                  dot={{ r: 3, fill: "#0284c7", strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </motion.div>
        )}
        {!rentalsMonthly.loading &&
        rentalsMonthly.data.length > 0 &&
        rentalSeriesMax === 0 &&
        !rentalsMonthly.error ? (
          <p className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">
            All months are 0 — create rent list entries with rent dates in the last year to see the line move.
          </p>
        ) : null}
      </PanelShell>

      <PanelShell title="Books by category" subtitle="Distribution of catalog" delay={0.05}>
        {categories.loading ? (
          <ChartSkeleton className="mx-auto h-[260px] max-w-[260px] rounded-full" />
        ) : categories.error && !categories.data.length ? (
          <p className="text-sm text-rose-600 dark:text-rose-400">{categories.error}</p>
        ) : categories.data.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No categorized books yet.</p>
        ) : (
          <motion.div
            initial={false}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35 }}
            className="h-[260px] w-full min-w-0 overflow-visible [&_.recharts-wrapper]:!overflow-visible"
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 28, right: 28, bottom: 8, left: 28 }}>
                <Pie
                  data={categories.data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={78}
                  paddingAngle={2}
                  animationDuration={600}
                  label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {categories.data.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, _name, item) => {
                    const n = Number(value ?? 0);
                    const pct = ((n / categoryTotal) * 100).toFixed(1);
                    const label =
                      item && typeof item === "object" && "payload" in item && item.payload && typeof item.payload === "object"
                        ? String((item.payload as { name?: string }).name ?? "")
                        : "";
                    return [`${n} books (${pct}%)`, label];
                  }}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid rgb(226 232 240)",
                    background: "rgba(255,255,255,0.95)"
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "12px", paddingTop: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </motion.div>
        )}
      </PanelShell>

      <PanelShell title="eBooks by category" subtitle="Distribution of digital catalog" delay={0.06}>
        {ebooksCategories.loading ? (
          <ChartSkeleton className="mx-auto h-[260px] max-w-[260px] rounded-full" />
        ) : ebooksCategories.error && !ebooksCategories.data.length ? (
          <p className="text-sm text-rose-600 dark:text-rose-400">{ebooksCategories.error}</p>
        ) : ebooksCategories.data.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No categorized eBooks yet.</p>
        ) : (
          <motion.div
            initial={false}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35 }}
            className="h-[260px] w-full min-w-0 overflow-visible [&_.recharts-wrapper]:!overflow-visible"
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 28, right: 28, bottom: 8, left: 28 }}>
                <Pie
                  data={ebooksCategories.data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={78}
                  paddingAngle={2}
                  animationDuration={600}
                  label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {ebooksCategories.data.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, _name, item) => {
                    const n = Number(value ?? 0);
                    const pct = ((n / ebooksCategoryTotal) * 100).toFixed(1);
                    const label =
                      item && typeof item === "object" && "payload" in item && item.payload && typeof item.payload === "object"
                        ? String((item.payload as { name?: string }).name ?? "")
                        : "";
                    return [`${n} eBooks (${pct}%)`, label];
                  }}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid rgb(226 232 240)",
                    background: "rgba(255,255,255,0.95)"
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "12px", paddingTop: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </motion.div>
        )}
      </PanelShell>

      {/* Popular books + eBooks (side by side on md+) */}
      <div className="grid grid-cols-1 gap-6 md:col-span-2 xl:col-span-4 md:grid-cols-2">
        <PanelShell title="Most popular books" subtitle="Top 5 by rental count" delay={0.1}>
          {popular.loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <ChartSkeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : popular.error && !popular.data.length ? (
            <p className="text-sm text-rose-600 dark:text-rose-400">{popular.error}</p>
          ) : popular.data.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No rental history yet.</p>
          ) : (
            <ul className="space-y-4">
              {popular.data.map((book, i) => (
                <motion.li
                  key={`${book.book_name}-${i}`}
                  initial={false}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.04 * i, duration: 0.25 }}
                >
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate font-medium text-slate-800 dark:text-slate-100">{book.book_name}</span>
                    <span className="shrink-0 tabular-nums text-slate-500 dark:text-slate-400">{book.rent_count}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-600/50">
                    <motion.div
                      className="h-full rounded-full bg-sky-500 dark:bg-sky-400"
                      initial={{ width: 0 }}
                      animate={{ width: `${(book.rent_count / maxRentCount) * 100}%` }}
                      transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 * i }}
                    />
                  </div>
                </motion.li>
              ))}
            </ul>
          )}
        </PanelShell>

        <PanelShell title="Most popular eBooks" subtitle="Top 5 by read activity" delay={0.11}>
          {popularEbooks.loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <ChartSkeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : popularEbooks.error && !popularEbooks.data.length ? (
            <p className="text-sm text-rose-600 dark:text-rose-400">{popularEbooks.error}</p>
          ) : popularEbooks.data.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No eBook reads recorded yet.</p>
          ) : (
            <ul className="space-y-4">
              {popularEbooks.data.map((eb, i) => (
                <motion.li
                  key={`${eb.ebook_name}-${i}`}
                  initial={false}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.04 * i, duration: 0.25 }}
                >
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate font-medium text-slate-800 dark:text-slate-100">{eb.ebook_name}</span>
                    <span className="shrink-0 tabular-nums text-slate-500 dark:text-slate-400">{eb.read_count}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-600/50">
                    <motion.div
                      className="h-full rounded-full bg-violet-500 dark:bg-violet-400"
                      initial={{ width: 0 }}
                      animate={{ width: `${(eb.read_count / maxEbookReadCount) * 100}%` }}
                      transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 * i }}
                    />
                  </div>
                </motion.li>
              ))}
            </ul>
          )}
        </PanelShell>
      </div>

      {/* Overdue */}
      <motion.div
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.06 }}
        whileHover={{ scale: 1.02 }}
        className={`${glassPanel} border-amber-200/80 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/25 md:col-span-2 xl:col-span-2`}
      >
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden />
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Overdue rentals</h3>
        </div>
        <p className="mb-4 text-xs text-slate-600 dark:text-slate-400">Active loans past the due date — follow up with members.</p>
        {overdue.loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <ChartSkeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : overdue.error && !overdue.data.length ? (
          <p className="text-sm text-rose-600 dark:text-rose-400">{overdue.error}</p>
        ) : overdue.data.length === 0 ? (
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">No overdue items. Great job.</p>
        ) : (
          <ul className="divide-y divide-amber-200/50 dark:divide-amber-900/40">
            {overdue.data.map((row, i) => (
              <li key={`${row.user_name}-${row.book_name}-${i}`} className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-sm first:pt-0">
                <div>
                  <span className="font-medium text-slate-800 dark:text-slate-100">{row.user_name}</span>
                  <span className="text-slate-500 dark:text-slate-400"> · </span>
                  <span className="text-slate-700 dark:text-slate-300">{row.book_name}</span>
                </div>
                <span className="shrink-0 rounded-lg bg-amber-100/80 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">
                  Due {row.due_date}
                </span>
              </li>
            ))}
          </ul>
        )}
      </motion.div>

      {/* User growth bar chart */}
      <PanelShell
        title="User growth"
        subtitle="New registrations by month"
        className="xl:col-span-2"
        delay={0.15}
      >
        <div className="mb-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <TrendingUp className="h-3.5 w-3.5" aria-hidden />
          Last 12 months
        </div>
        {userGrowth.loading ? (
          <ChartSkeleton className="h-[280px] w-full" />
        ) : userGrowth.error && !userGrowth.data.length ? (
          <p className="text-sm text-rose-600 dark:text-rose-400">{userGrowth.error}</p>
        ) : !userGrowth.data.length ? (
          <ChartEmptyState
            title="No user growth data loaded"
            hint="Same as monthly rentals: confirm GET /api/dashboard/summary includes analytics.userGrowth (12 points). Register new members to populate bars once the API returns data."
          />
        ) : (
          <motion.div
            initial={false}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35 }}
            className="h-[280px] w-full min-w-0"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={userGrowth.data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-slate-200 dark:stroke-slate-600" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  width={32}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, Math.max(4, userGrowthMax + 1)]}
                />
                <Tooltip
                  formatter={(v) => [Number(v ?? 0), "New users"]}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid rgb(226 232 240)",
                    background: "rgba(255,255,255,0.95)"
                  }}
                />
                <Bar dataKey="total" fill="#6366f1" radius={[6, 6, 0, 0]} animationDuration={600} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        )}
        {!userGrowth.loading && userGrowth.data.length > 0 && userGrowthMax === 0 && !userGrowth.error ? (
          <p className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">
            All months are 0 — register members (or insert users with created_at) to see growth bars.
          </p>
        ) : null}
      </PanelShell>
    </div>
  );
};

export default DashboardAnalytics;
