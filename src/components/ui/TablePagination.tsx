import { motion } from "framer-motion";
import { useMemo } from "react";

export type TablePaginationProps = {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
};

function buildPageNumbers(
  totalPages: number,
  current: number,
): (number | "ellipsis")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages = new Set<number>();
  pages.add(1);
  pages.add(totalPages);
  for (let d = -1; d <= 1; d++) {
    const p = current + d;
    if (p >= 1 && p <= totalPages) pages.add(p);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | "ellipsis")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) out.push("ellipsis");
    out.push(p);
    prev = p;
  }
  return out;
}

const glassShell =
  "mt-6 flex flex-col gap-4 rounded-2xl border border-slate-200/60 bg-white/60 px-4 py-3.5 shadow-md backdrop-blur-md dark:border-slate-700/60 dark:bg-slate-800/60 md:flex-row md:items-center md:justify-between";

const selectClass =
  "rounded-full border border-slate-200/80 bg-white/90 px-3 py-1.5 text-sm text-slate-700 shadow-sm outline-none transition focus:ring-2 focus:ring-primary/40 dark:border-slate-600 dark:bg-slate-700/90 dark:text-slate-100";

const btnNav =
  "rounded-full border border-slate-200/80 bg-white/80 px-3.5 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-primary/35 hover:bg-white hover:shadow dark:border-slate-600 dark:bg-slate-700/80 dark:text-slate-200 dark:hover:border-primary/40 dark:hover:bg-slate-600 disabled:pointer-events-none disabled:opacity-40";

const btnPage =
  "min-w-[2.35rem] rounded-full border border-slate-200/80 bg-white/80 px-2.5 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-primary/35 hover:bg-white dark:border-slate-600 dark:bg-slate-700/80 dark:text-slate-200 dark:hover:border-primary/40 dark:hover:bg-slate-600";

const btnPageActive =
  "border-primary bg-primary text-white shadow-md hover:border-primary hover:bg-primary dark:hover:bg-primary";

const TablePagination = ({
  page,
  limit,
  total,
  onPageChange,
  onLimitChange,
}: TablePaginationProps) => {
  const totalPages = useMemo(() => {
    if (total <= 0) return 1;
    return Math.ceil(total / limit);
  }, [total, limit]);

  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = total === 0 ? 0 : Math.min(page * limit, total);

  const pageNumbers = useMemo(
    () => buildPageNumbers(totalPages, page),
    [totalPages, page],
  );

  const canPrev = page > 1;
  const canNext = page < totalPages && total > 0;

  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={glassShell}
      role="navigation"
      aria-label="Table pagination"
    >
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="whitespace-nowrap text-slate-500 dark:text-slate-400">
          Rows
        </span>
        <select
          value={limit}
          onChange={(e) => onLimitChange(Number(e.target.value))}
          className={selectClass}
          aria-label="Rows per page"
        >
          <option value={10}>10</option>
          <option value={25}>25</option>
          <option value={50}>50</option>
        </select>
        <span className="text-slate-500 dark:text-slate-400">
          {total === 0 ? (
            <>0 of 0</>
          ) : (
            <>
              {start}–{end} of {total}
            </>
          )}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-1 md:justify-end">
        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          disabled={!canPrev}
          onClick={() => onPageChange(page - 1)}
          className={btnNav}
          aria-label="Previous page"
        >
          Prev
        </motion.button>

        {total > 0 &&
          pageNumbers.map((item, idx) =>
            item === "ellipsis" ? (
              <span
                key={`e-${idx}`}
                className="px-1.5 text-sm text-slate-400 dark:text-slate-500"
                aria-hidden
              >
                …
              </span>
            ) : (
              <motion.button
                key={item}
                type="button"
                whileTap={{ scale: 0.9 }}
                onClick={() => onPageChange(item)}
                className={`${btnPage} ${item === page ? btnPageActive : ""}`}
                aria-label={`Page ${item}`}
                aria-current={item === page ? "page" : undefined}
              >
                {item}
              </motion.button>
            ),
          )}

        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          disabled={!canNext}
          onClick={() => onPageChange(page + 1)}
          className={btnNav}
          aria-label="Next page"
        >
          Next
        </motion.button>
      </div>
    </motion.div>
  );
};

export default TablePagination;
