import { Ref } from "react";

type Props = {
  sentinelRef: Ref<HTMLDivElement>;
  hasMore: boolean;
};

/** Sentinel + hint for optional infinite-scroll tables. */
const TableInfiniteFooter = ({ sentinelRef, hasMore }: Props) => {
  if (!hasMore) return null;
  return (
    <div
      ref={sentinelRef}
      className="mt-4 flex min-h-10 items-center justify-center rounded-2xl border border-dashed border-slate-200/70 bg-white/50 px-3 py-2 text-xs text-slate-500 backdrop-blur-sm dark:border-slate-600/80 dark:bg-slate-800/50 dark:text-slate-400"
      aria-hidden
    >
      Scroll for more rows…
    </div>
  );
};

export default TableInfiniteFooter;
