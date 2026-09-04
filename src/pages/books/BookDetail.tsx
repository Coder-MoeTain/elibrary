import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { BookItem, getApiErrorMessage, getBookAvailability, getBookById } from "../../services/api";

type Toast = { kind: "success" | "error"; message: string } | null;

const FALLBACK_COVER = "/sidebar-admin-icon.png";

const BookDetail = () => {
  const { id } = useParams();
  const location = useLocation();
  const bookId = Number(id);
  const isAdmin = location.pathname.startsWith("/admin");
  const backPath = isAdmin ? "/admin/books" : "/member/books";

  const [book, setBook] = useState<BookItem | null>(null);
  const [available, setAvailable] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<Toast>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const [b, a] = await Promise.all([getBookById(bookId), getBookAvailability(bookId)]);
        if (!cancelled) {
          setBook(b);
          setAvailable(a.available);
        }
      } catch (err) {
        if (!cancelled) setToast({ kind: "error", message: getApiErrorMessage(err) });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (Number.isFinite(bookId) && bookId > 0) void load();
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200/60 bg-white/70 p-8 text-center text-sm text-slate-500 shadow-lg backdrop-blur-md dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300">
        Loading book detail...
      </div>
    );
  }

  if (!book) {
    return (
      <div className="space-y-4">
        <Link to={backPath} className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to books
        </Link>
        <div className="rounded-2xl border border-slate-200/60 bg-white/70 p-8 text-center text-sm text-slate-500 shadow-lg backdrop-blur-md dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300">
          Book not found.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to={backPath} className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to books
      </Link>

      {toast && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-200">
          {toast.message}
        </div>
      )}

      <motion.section
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-slate-200/60 bg-white/70 p-6 shadow-lg backdrop-blur-md dark:border-slate-700 dark:bg-slate-800/70"
      >
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="w-full max-w-[260px] overflow-hidden rounded-2xl border border-slate-200/70 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
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

          <div className="flex-1 space-y-4">
            <div>
              <h2 className="text-3xl font-bold text-slate-800 dark:text-white">{book.book_name}</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                by {book.author_name || "Unknown author"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 dark:text-slate-300">
              <span>
                <strong>Category:</strong> {book.category_name || "-"}
              </span>
              <span>
                <strong>Place:</strong> {book.place || "-"}
              </span>
              <span>
                <strong>Release:</strong> {book.release_date || "-"}
              </span>
              <span
                className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${
                  available
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                    : "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
                }`}
              >
                {available ? "Available" : "Unavailable"}
              </span>
            </div>

            <div className="rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-600 dark:bg-slate-900 dark:text-slate-300">
              {book.description || "No description available."}
            </div>
          </div>
        </div>
      </motion.section>
    </div>
  );
};

export default BookDetail;
