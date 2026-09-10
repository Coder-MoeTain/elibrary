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

const cardClass =
  "rounded-2xl border border-slate-200/60 bg-white/70 p-6 shadow-lg backdrop-blur-md transition hover:shadow-xl dark:border-slate-700 dark:bg-slate-800/70";

const gridClass =
  "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5";
const FALLBACK_COVER = "/sidebar-admin-icon.png";

const skeletonPlaceholders = Array.from({ length: 5 }, (_, i) => i);

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
    <div className="rounded-2xl border border-slate-200/60 p-3 transition hover:scale-105 hover:shadow-xl dark:border-slate-700">
      <div className="mb-3 aspect-[3/4] overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-700/70">
        {item.cover_image ? (
          <img
            src={item.cover_image}
            alt={item.ebook_name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs font-semibold text-slate-500 dark:text-slate-300">
            No Cover
          </div>
        )}
      </div>
      <p className="line-clamp-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
        {item.ebook_name}
      </p>
      <p className="mt-1 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
        {item.author_name || "Unknown author"}
      </p>
      {showReads ? (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Reads: {item.read_count}
        </p>
      ) : null}
      <Button
        type="button"
        className="mt-2 w-full justify-center"
        onClick={onDetail}
      >
        See Detail
      </Button>
    </div>
  );
}

function EbookHomeSection({
  title,
  caption,
  items,
  loading,
  emptyText,
  showReads,
  onDetail,
  motionDelay,
}: {
  title: string;
  caption?: string;
  items: EbookItem[];
  loading: boolean;
  emptyText: string;
  showReads: boolean;
  onDetail: (id: number) => void;
  motionDelay: number;
}) {
  return (
    <motion.section
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: motionDelay }}
      className={cardClass}
    >
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
          {title}
        </h3>
        {caption ? (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {caption}
          </p>
        ) : null}
      </div>

      {loading ? (
        <div className={gridClass}>
          {skeletonPlaceholders.map((item) => (
            <div
              key={item}
              className="animate-pulse rounded-2xl border border-slate-200/60 p-3 dark:border-slate-700"
            >
              <div className="mb-3 aspect-[3/4] w-full rounded-xl bg-slate-200 dark:bg-slate-700" />
              <div className="h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-700" />
              <div className="mt-2 h-3 w-1/2 rounded bg-slate-200 dark:bg-slate-700" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-600 dark:text-slate-300">
          {emptyText}
        </div>
      ) : (
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
          getBooksPage({ page: 1, limit: 8 }),
          getRecommendedEbooks(),
          getMostPopularEbooks(),
          getNewUploads(),
        ]);
        if (!cancelled) {
          setBooks(physical.items.slice(0, 5));
          setRecommended(rec);
          setPopular(pop);
          setNewUploads(neu);
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
    <div className="space-y-6">
      <PageHeader title="Home" description="Recommended titles, popular reads, and new arrivals." />

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
        transition={{ delay: 0.02 }}
        className={cardClass}
      >
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Recommended Books</h3>
        </div>
        {loading ? (
          <div className={gridClass}>
            {skeletonPlaceholders.map((item) => (
              <div
                key={item}
                className="animate-pulse rounded-2xl border border-slate-200/60 p-3 dark:border-slate-700"
              >
                <div className="mb-3 aspect-[3/4] w-full rounded-xl bg-slate-200 dark:bg-slate-700" />
                <div className="h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-700" />
                <div className="mt-2 h-3 w-1/2 rounded bg-slate-200 dark:bg-slate-700" />
              </div>
            ))}
          </div>
        ) : books.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-600 dark:text-slate-300">
            No books found.
          </div>
        ) : (
          <div className={gridClass}>
            {books.map((book) => (
              <div
                key={book.book_id}
                className="rounded-2xl border border-slate-200/60 p-3 transition hover:scale-105 hover:shadow-xl dark:border-slate-700"
              >
                <div className="mb-3 aspect-[3/4] overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-700/70">
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
                <p className="line-clamp-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {book.book_name}
                </p>
                <p className="mt-1 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
                  {book.author_name || "Unknown author"}
                </p>
                <Button type="button" className="mt-2 w-full justify-center" onClick={() => goBookDetail(book.book_id)}>
                  See Detail
                </Button>
              </div>
            ))}
          </div>
        )}
      </motion.section>

      <EbookHomeSection
        title="Recommended e-Books"
        caption=""
        items={recommended.slice(0, 5)}
        loading={loading}
        emptyText="No books found."
        showReads
        onDetail={goDetail}
        motionDelay={0.04}
      />

      <EbookHomeSection
        title="Most Popular"
        caption=""
        items={popular}
        loading={loading}
        emptyText="No popular e-books yet."
        showReads
        onDetail={goDetail}
        motionDelay={0.08}
      />

      <EbookHomeSection
        title="New Uploads"
        caption=""
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
