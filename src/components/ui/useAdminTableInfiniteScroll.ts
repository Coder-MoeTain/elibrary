import { useEffect, useState } from "react";
import { useInView } from "react-intersection-observer";

type Options = {
  /** Rows to append each time the sentinel enters view. */
  step?: number;
  rootMargin?: string;
};

/**
 * Optional infinite scroll for admin tables. Reset by changing `resetKey` (e.g. search + filters).
 */
export function useAdminTableInfiniteScroll<T>(
  items: T[],
  resetKey: string,
  options: Options = {},
) {
  const step = options.step ?? 10;
  const { ref: sentinelRef, inView } = useInView({
    threshold: 0,
    rootMargin: options.rootMargin ?? "160px",
  });

  const [visibleCount, setVisibleCount] = useState(step);

  useEffect(() => {
    setVisibleCount(step);
  }, [step, resetKey]);

  useEffect(() => {
    if (inView && visibleCount < items.length) {
      setVisibleCount((c) => Math.min(c + step, items.length));
    }
  }, [inView, items.length, step, visibleCount]);

  const visibleSlice = items.slice(0, visibleCount);
  const hasMore = visibleCount < items.length;

  return { sentinelRef, visibleSlice, hasMore };
}
