import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../components/ui/Button";
import PageHeader from "../../components/ui/PageHeader";
import {
  BookItem,
  EbookItem,
  getApiErrorMessage,
  getBooksPage,
  getEbooksPage,
  getMostPopularBooks,
  getMostPopularEbooks,
  getNewUploads,
  getRecommendedEbooks,
} from "../../services/api";

type Toast = { kind: "success" | "error"; message: string } | null;

type PopularEntry =
  | { kind: "ebook"; item: EbookItem }
  | { kind: "paper"; item: EbookItem }
  | { kind: "book"; item: BookItem };

/** Visible cards per slide (6-column row). */
const SLIDE_SIZE = 6;
/** Fetch enough items so users can slide through several pages. */
const POOL_SIZE = 30;
/** Per-type fetch size before interleaving into Most Popular. */
const POPULAR_PER_TYPE = 15;

/** Round-robin mix of e-books, physical books, and research papers. */
function interleavePopular(
  ebooks: EbookItem[],
  books: BookItem[],
  papers: EbookItem[],
  limit: number
): PopularEntry[] {
  const queues: PopularEntry[][] = [
    ebooks.map((item) => ({ kind: "ebook", item })),
    books.map((item) => ({ kind: "book", item })),
    papers.map((item) => ({ kind: "paper", item })),
  ];
  const out: PopularEntry[] = [];
  let cursor = 0;
  while (out.length < limit) {
    let progressed = false;
    for (let n = 0; n < queues.length && out.length < limit; n += 1) {
      const q = queues[(cursor + n) % queues.length];
      const next = q.shift();
      if (!next) continue;
      out.push(next);
      progressed = true;
    }
    cursor = (cursor + 1) % queues.length;
    if (!progressed) break;
  }
  return out;
}

const sectionClass =
  "flex min-h-0 flex-col rounded-2xl border border-slate-200/60 bg-white/70 p-3 shadow-lg backdrop-blur-md dark:border-slate-700 dark:bg-slate-800/70 sm:p-4";

const gridClass =
  "grid h-full min-h-0 grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 lg:grid-rows-1 lg:gap-2.5";

const miniCardClass =
  "relative flex h-full min-h-0 flex-col rounded-xl border border-slate-200/60 bg-white/60 p-1.5 shadow-md transition hover:shadow-lg dark:border-slate-700 dark:bg-slate-800/50";

const coverShellClass =
  "mb-1 flex min-h-0 flex-1 items-center justify-center overflow-hidden";

const coverFrameClass =
  "aspect-[3/4] w-full max-h-full overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-700/70 lg:h-full lg:w-auto lg:max-w-full";

const navBtnClass =
  "absolute top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200/80 bg-white/95 text-slate-700 shadow-md transition hover:bg-white disabled:pointer-events-none disabled:opacity-35 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700";

const FALLBACK_COVER = "/sidebar-admin-icon.png";

const skeletonPlaceholders = Array.from({ length: SLIDE_SIZE }, (_, i) => i);

function EbookMiniCard({
  item,
  showReads,
  onDetail,
}: {
  item: EbookItem;
  showReads: boolean;
  onDetail: () => void;
}) {
  return (
    <div className={miniCardClass}>
      <div className={coverShellClass}>
        <div className={coverFrameClass}>
          {item.cover_image ? (
            <img
              src={item.cover_image}
              alt={item.ebook_name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-slate-500 dark:text-slate-300">
              No Cover
            </div>
          )}
        </div>
      </div>
      <p className="line-clamp-1 shrink-0 text-center text-[11px] font-semibold text-slate-800 dark:text-slate-100 lg:text-xs">
        {item.ebook_name}
      </p>
      <p className="mt-0.5 line-clamp-1 shrink-0 text-center text-[10px] text-slate-500 dark:text-slate-400">
        {item.author_name || "Unknown author"}
      </p>
      {showReads ? (
        <p className="mt-0.5 shrink-0 text-center text-[10px] text-slate-500 dark:text-slate-400">
          Reads: {item.read_count}
        </p>
      ) : null}
      <Button
        type="button"
        className="mt-1 w-full shrink-0 justify-center rounded-md px-1.5 py-1 text-[10px] lg:text-xs"
        onClick={onDetail}
      >
        See Detail
      </Button>
    </div>
  );
}

function BookMiniCard({
  book,
  onDetail,
}: {
  book: BookItem;
  onDetail: () => void;
}) {
  return (
    <div className={miniCardClass}>
      <div className={coverShellClass}>
        <div className={coverFrameClass}>
          <img
            src={book.cover_image || FALLBACK_COVER}
            alt={book.book_name}
            loading="lazy"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = FALLBACK_COVER;
            }}
            className="h-full w-full object-cover"
          />
        </div>
      </div>
      <p className="line-clamp-1 shrink-0 text-center text-[11px] font-semibold text-slate-800 dark:text-slate-100 lg:text-xs">
        {book.book_name}
      </p>
      <p className="mt-0.5 line-clamp-1 shrink-0 text-center text-[10px] text-slate-500 dark:text-slate-400">
        {book.author_name || "Unknown author"}
      </p>
      <Button
        type="button"
        className="mt-1 w-full shrink-0 justify-center rounded-md px-1.5 py-1 text-[10px] lg:text-xs"
        onClick={onDetail}
      >
        See Detail
      </Button>
    </div>
  );
}

function SectionSkeleton() {
  return (
    <div className={gridClass}>
      {skeletonPlaceholders.map((item) => (
        <div key={item} className={`${miniCardClass} animate-pulse`}>
          <div className={coverShellClass}>
            <div className={`${coverFrameClass} bg-slate-200 dark:bg-slate-700`} />
          </div>
          <div className="mx-auto h-2.5 w-4/5 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="mt-1 h-7 w-full rounded-md bg-slate-200 dark:bg-slate-700" />
        </div>
      ))}
    </div>
  );
}

const slideVariants = {
  enter: (direction: number) => ({
    x: direction >= 0 ? 56 : -56,
    opacity: 0
  }),
  center: {
    x: 0,
    opacity: 1
  },
  exit: (direction: number) => ({
    x: direction >= 0 ? -56 : 56,
    opacity: 0
  })
};

function SlideRow({
  title,
  loading,
  emptyText,
  totalCount,
  slideIndex,
  direction,
  onPrev,
  onNext,
  children,
  fitViewport,
  motionDelay = 0,
}: {
  title: string;
  loading: boolean;
  emptyText: string;
  totalCount: number;
  slideIndex: number;
  direction: number;
  onPrev: () => void;
  onNext: () => void;
  children: ReactNode;
  fitViewport?: boolean;
  motionDelay?: number;
}) {
  const totalSlides = Math.max(1, Math.ceil(totalCount / SLIDE_SIZE));
  const canPrev = slideIndex > 0;
  const canNext = slideIndex < totalSlides - 1 && totalCount > SLIDE_SIZE;

  return (
    <motion.section
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: motionDelay }}
      className={`${sectionClass} ${fitViewport ? "lg:min-h-0 lg:flex-1" : ""}`}
    >
      <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 lg:text-lg">
          {title}
        </h3>
        {!loading && totalCount > 0 ? (
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {slideIndex + 1} / {totalSlides}
          </p>
        ) : null}
      </div>

      {loading ? (
        <div className="min-h-0 flex-1">
          <SectionSkeleton />
        </div>
      ) : totalCount === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-600 dark:text-slate-300">
          {emptyText}
        </div>
      ) : (
        <div className="relative min-h-0 flex-1 px-0 sm:px-1 lg:px-2">
          <button
            type="button"
            className={`${navBtnClass} left-0 lg:-left-1`}
            aria-label="Previous"
            disabled={!canPrev}
            onClick={onPrev}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            className={`${navBtnClass} right-0 lg:-right-1`}
            aria-label="Next"
            disabled={!canNext}
            onClick={onNext}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="relative h-full min-h-0 overflow-hidden px-5 sm:px-6">
            <AnimatePresence initial={false} custom={direction} mode="wait">
              <motion.div
                key={slideIndex}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
                className="h-full min-h-0 w-full"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      )}
    </motion.section>
  );
}

function useSlidePager(itemCount: number) {
  const [slideIndex, setSlideIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const totalSlides = Math.max(1, Math.ceil(itemCount / SLIDE_SIZE));
  const slideIndexRef = useRef(slideIndex);
  slideIndexRef.current = slideIndex;

  useEffect(() => {
    setSlideIndex((i) => Math.min(i, Math.max(0, totalSlides - 1)));
  }, [totalSlides]);

  const pageSlice = useMemo(() => {
    const start = slideIndex * SLIDE_SIZE;
    return { start, end: start + SLIDE_SIZE };
  }, [slideIndex]);

  return {
    slideIndex,
    direction,
    totalSlides,
    pageSlice,
    goPrev: () => {
      const cur = slideIndexRef.current;
      if (cur <= 0) return;
      setDirection(-1);
      setSlideIndex(cur - 1);
    },
    goNext: () => {
      const cur = slideIndexRef.current;
      if (cur >= totalSlides - 1) return;
      setDirection(1);
      setSlideIndex(cur + 1);
    },
  };
}

const Home = () => {
  const navigate = useNavigate();
  const [books, setBooks] = useState<BookItem[]>([]);
  const [recommended, setRecommended] = useState<EbookItem[]>([]);
  const [popular, setPopular] = useState<PopularEntry[]>([]);
  const [newUploads, setNewUploads] = useState<EbookItem[]>([]);
  const [papers, setPapers] = useState<EbookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<Toast>(null);

  const booksPager = useSlidePager(books.length);
  const recommendedPager = useSlidePager(recommended.length);
  const popularPager = useSlidePager(popular.length);
  const newUploadsPager = useSlidePager(newUploads.length);
  const papersPager = useSlidePager(papers.length);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const [
          physical,
          rec,
          popEbooks,
          popBooks,
          popPapers,
          neu,
          paperPage,
        ] = await Promise.all([
          getBooksPage({ page: 1, limit: POOL_SIZE }),
          getRecommendedEbooks(POOL_SIZE),
          getMostPopularEbooks(POPULAR_PER_TYPE, { contentType: "ebook" }),
          getMostPopularBooks(POPULAR_PER_TYPE),
          getMostPopularEbooks(POPULAR_PER_TYPE, { contentType: "paper" }),
          getNewUploads(POOL_SIZE),
          getEbooksPage({ page: 1, limit: POOL_SIZE, contentType: "paper" }),
        ]);
        if (!cancelled) {
          setBooks(physical.items.slice(0, POOL_SIZE));
          setRecommended(rec.slice(0, POOL_SIZE));
          setPopular(
            interleavePopular(popEbooks, popBooks, popPapers, POOL_SIZE)
          );
          setNewUploads(neu.slice(0, POOL_SIZE));
          setPapers(paperPage.items.slice(0, POOL_SIZE));
        }
      } catch (err) {
        if (!cancelled)
          setToast({ kind: "error", message: getApiErrorMessage(err) });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const goDetail = (id: number) => navigate(`/member/ebooks/${id}`);
  const goPaperDetail = (id: number) => navigate(`/member/papers/${id}`);
  const goBookDetail = (id: number) => navigate(`/member/books/${id}`);

  const visibleBooks = books.slice(booksPager.pageSlice.start, booksPager.pageSlice.end);
  const visibleRecommended = recommended.slice(
    recommendedPager.pageSlice.start,
    recommendedPager.pageSlice.end
  );
  const visiblePopular = popular.slice(popularPager.pageSlice.start, popularPager.pageSlice.end);
  const visibleNewUploads = newUploads.slice(
    newUploadsPager.pageSlice.start,
    newUploadsPager.pageSlice.end
  );
  const visiblePapers = papers.slice(papersPager.pageSlice.start, papersPager.pageSlice.end);

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex flex-col gap-2 lg:h-[calc(100dvh-9rem)] lg:min-h-0 lg:gap-2.5 lg:overflow-hidden">
        <div className="shrink-0">
          <PageHeader
            title="Home"
            description="Recommended titles, popular reads, and new arrivals."
          />
          {toast && (
            <div
              className={`mt-2 rounded-xl border px-3 py-2 text-sm ${
                toast.kind === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
                  : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-200"
              }`}
            >
              {toast.message}
            </div>
          )}
        </div>

        <SlideRow
          title="Recommended Books"
          loading={loading}
          emptyText="No books found."
          totalCount={books.length}
          slideIndex={booksPager.slideIndex}
          direction={booksPager.direction}
          onPrev={booksPager.goPrev}
          onNext={booksPager.goNext}
          fitViewport
          motionDelay={0.02}
        >
          <div className={gridClass}>
            {visibleBooks.map((book) => (
              <BookMiniCard
                key={book.book_id}
                book={book}
                onDetail={() => goBookDetail(book.book_id)}
              />
            ))}
          </div>
        </SlideRow>

        <SlideRow
          title="Recommended e-Books"
          loading={loading}
          emptyText="No books found."
          totalCount={recommended.length}
          slideIndex={recommendedPager.slideIndex}
          direction={recommendedPager.direction}
          onPrev={recommendedPager.goPrev}
          onNext={recommendedPager.goNext}
          fitViewport
          motionDelay={0.04}
        >
          <div className={gridClass}>
            {visibleRecommended.map((item) => (
              <EbookMiniCard
                key={item.ebook_id}
                item={item}
                showReads
                onDetail={() => goDetail(item.ebook_id)}
              />
            ))}
          </div>
        </SlideRow>
      </div>

      <div className="flex flex-col gap-2 lg:h-[calc(100dvh-9rem)] lg:min-h-0 lg:gap-2.5 lg:overflow-hidden">
        <SlideRow
          title="Most Popular"
          loading={loading}
          emptyText="No popular titles yet."
          totalCount={popular.length}
          slideIndex={popularPager.slideIndex}
          direction={popularPager.direction}
          onPrev={popularPager.goPrev}
          onNext={popularPager.goNext}
          fitViewport
          motionDelay={0.08}
        >
          <div className={gridClass}>
            {visiblePopular.map((entry) => {
              if (entry.kind === "book") {
                return (
                  <BookMiniCard
                    key={`book-${entry.item.book_id}`}
                    book={entry.item}
                    onDetail={() => goBookDetail(entry.item.book_id)}
                  />
                );
              }
              if (entry.kind === "paper") {
                return (
                  <EbookMiniCard
                    key={`paper-${entry.item.ebook_id}`}
                    item={entry.item}
                    showReads
                    onDetail={() => goPaperDetail(entry.item.ebook_id)}
                  />
                );
              }
              return (
                <EbookMiniCard
                  key={`ebook-${entry.item.ebook_id}`}
                  item={entry.item}
                  showReads
                  onDetail={() => goDetail(entry.item.ebook_id)}
                />
              );
            })}
          </div>
        </SlideRow>

        <SlideRow
          title="New Uploads"
          loading={loading}
          emptyText="No new uploads yet."
          totalCount={newUploads.length}
          slideIndex={newUploadsPager.slideIndex}
          direction={newUploadsPager.direction}
          onPrev={newUploadsPager.goPrev}
          onNext={newUploadsPager.goNext}
          fitViewport
          motionDelay={0.12}
        >
          <div className={gridClass}>
            {visibleNewUploads.map((item) => (
              <EbookMiniCard
                key={item.ebook_id}
                item={item}
                showReads
                onDetail={() => goDetail(item.ebook_id)}
              />
            ))}
          </div>
        </SlideRow>
      </div>

      {/* Third screen: Recommended Research Papers (6 visible, slide through ~30) */}
      <div className="flex flex-col gap-2 lg:h-[calc((100dvh-9rem)/2)] lg:min-h-0 lg:overflow-hidden">
        <SlideRow
          title="Recommended Research Papers"
          loading={loading}
          emptyText="No research papers found."
          totalCount={papers.length}
          slideIndex={papersPager.slideIndex}
          direction={papersPager.direction}
          onPrev={papersPager.goPrev}
          onNext={papersPager.goNext}
          fitViewport
          motionDelay={0.16}
        >
          <div className={gridClass}>
            {visiblePapers.map((item) => (
              <EbookMiniCard
                key={item.ebook_id}
                item={item}
                showReads={false}
                onDetail={() => goPaperDetail(item.ebook_id)}
              />
            ))}
          </div>
        </SlideRow>
      </div>
    </div>
  );
};

export default Home;
