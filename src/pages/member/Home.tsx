import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../components/ui/Button";
import PageHeader from "../../components/ui/PageHeader";
import {
  BookItem,
  EbookItem,
  getApiErrorMessage,
  getBooksPage,
  getMostPopularEbooks,
  getNewUploads,
  getRecommendedEbooks,
} from "../../services/api";

type Toast = { kind: "success" | "error"; message: string } | null;

/** One catalog-style row: 6 columns. First screen shows Books 6 + e-Books 6 = 12. */
const HOME_ROW_SIZE = 6;

const sectionClass =
  "flex min-h-0 flex-col rounded-2xl border border-slate-200/60 bg-white/70 p-3 shadow-lg backdrop-blur-md dark:border-slate-700 dark:bg-slate-800/70 sm:p-4";

/** Always 6 columns from large desktop up (full browser). */
const gridClass =
  "grid h-full min-h-0 grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 lg:grid-rows-1 lg:gap-2.5";

const miniCardClass =
  "relative flex h-full min-h-0 flex-col rounded-xl border border-slate-200/60 bg-white/60 p-1.5 shadow-md transition hover:shadow-lg dark:border-slate-700 dark:bg-slate-800/50";

const coverShellClass =
  "mb-1 flex min-h-0 flex-1 items-center justify-center overflow-hidden";

const coverFrameClass =
  "aspect-[3/4] w-full max-h-full overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-700/70 lg:h-full lg:w-auto lg:max-w-full";

const FALLBACK_COVER = "/sidebar-admin-icon.png";

const skeletonPlaceholders = Array.from({ length: HOME_ROW_SIZE }, (_, i) => i);

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

function EbookHomeSection({
  title,
  items,
  loading,
  emptyText,
  showReads,
  onDetail,
  motionDelay,
  fitViewport,
}: {
  title: string;
  items: EbookItem[];
  loading: boolean;
  emptyText: string;
  showReads: boolean;
  onDetail: (id: number) => void;
  motionDelay: number;
  /** When true, section fills half of the first-screen stack (Books + e-Books). */
  fitViewport?: boolean;
}) {
  return (
    <motion.section
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: motionDelay }}
      className={`${sectionClass} ${fitViewport ? "lg:min-h-0 lg:flex-1" : ""}`}
    >
      <h3 className="mb-2 shrink-0 text-base font-semibold text-slate-800 dark:text-slate-100 lg:text-lg">
        {title}
      </h3>

      {loading ? (
        <div className="min-h-0 flex-1">{SectionSkeleton()}</div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-600 dark:text-slate-300">
          {emptyText}
        </div>
      ) : (
        <div className={`min-h-0 ${fitViewport ? "flex-1" : ""}`}>
          <div className={gridClass}>
            {items.map((item) => (
              <EbookMiniCard
                key={item.ebook_id}
                item={item}
                showReads={showReads}
                onDetail={() => onDetail(item.ebook_id)}
              />
            ))}
          </div>
        </div>
      )}
    </motion.section>
  );
}

const Home = () => {
  const navigate = useNavigate();
  const [books, setBooks] = useState<BookItem[]>([]);
  const [recommended, setRecommended] = useState<EbookItem[]>([]);
  const [popular, setPopular] = useState<EbookItem[]>([]);
  const [newUploads, setNewUploads] = useState<EbookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<Toast>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const [physical, rec, pop, neu] = await Promise.all([
          getBooksPage({ page: 1, limit: HOME_ROW_SIZE }),
          getRecommendedEbooks(),
          getMostPopularEbooks(),
          getNewUploads(),
        ]);
        if (!cancelled) {
          setBooks(physical.items.slice(0, HOME_ROW_SIZE));
          setRecommended(rec.slice(0, HOME_ROW_SIZE));
          setPopular(pop.slice(0, HOME_ROW_SIZE));
          setNewUploads(neu.slice(0, HOME_ROW_SIZE));
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
  const goBookDetail = (id: number) => navigate(`/member/books/${id}`);

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* First screen: header + 6 books + 6 e-books = 12 cards (full browser, no scroll needed) */}
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

        <motion.section
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.02 }}
          className={`${sectionClass} lg:min-h-0 lg:flex-1`}
        >
          <h3 className="mb-2 shrink-0 text-base font-semibold text-slate-800 dark:text-slate-100 lg:text-lg">
            Recommended Books
          </h3>
          {loading ? (
            <div className="min-h-0 flex-1">
              <SectionSkeleton />
            </div>
          ) : books.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-600 dark:text-slate-300">
              No books found.
            </div>
          ) : (
            <div className="min-h-0 flex-1">
              <div className={gridClass}>
                {books.map((book) => (
                  <div key={book.book_id} className={miniCardClass}>
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
                      onClick={() => goBookDetail(book.book_id)}
                    >
                      See Detail
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.section>

        <EbookHomeSection
          title="Recommended e-Books"
          items={recommended}
          loading={loading}
          emptyText="No books found."
          showReads
          onDetail={goDetail}
          motionDelay={0.04}
          fitViewport
        />
      </div>

      {/* Below the fold — appear when scrolling */}
      <EbookHomeSection
        title="Most Popular"
        items={popular}
        loading={loading}
        emptyText="No popular e-books yet."
        showReads
        onDetail={goDetail}
        motionDelay={0.08}
      />

      <EbookHomeSection
        title="New Uploads"
        items={newUploads}
        loading={loading}
        emptyText="No new uploads yet."
        showReads
        onDetail={goDetail}
        motionDelay={0.12}
      />
    </div>
  );
};

export default Home;
