import { motion } from "framer-motion";
import { ArrowLeft, Check, Download, FileText, Heart } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import Button from "../../components/ui/Button";
import { EBOOKS_LIST_STATE_KEY } from "./Ebooks";
import {
  buildCoverThumbnailUrl,
  downloadEbookPdf,
  EbookItem,
  generateEbookSummary,
  getApiErrorMessage,
  getEbookById,
  getEbookSummary,
  getFavorites,
  openEbookPdf,
  SummaryLanguage,
  toggleFavorite,
  trackEbookRead
} from "../../services/api";

type Toast = { kind: "success" | "error"; message: string } | null;
const FALLBACK_COVER = "/sidebar-admin-icon.png";
const COVER_RETRY_MAX = 2;

function withRetryBuster(url: string, attempt: number): string {
  if (!url || attempt <= 0) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}r=${attempt}`;
}

const SUMMARY_LANG_OPTIONS: { value: SummaryLanguage; label: string }[] = [
  { value: "en", label: "English" },
  { value: "my", label: "မြန်မာ" }
];

const EbookDetail = () => {
  const { id } = useParams();
  const location = useLocation();
  const ebookId = Number(id);
  const ebooksListPath = location.pathname.startsWith("/admin") ? "/admin/ebooks" : "/member/ebooks";
  const ebooksListSearch =
    (location.state as { ebooksListSearch?: string } | null)?.ebooksListSearch ??
    sessionStorage.getItem(EBOOKS_LIST_STATE_KEY) ??
    "";
  const backToEbooksPath = `${ebooksListPath}${ebooksListSearch}`;
  const [book, setBook] = useState<EbookItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [trackingRead, setTrackingRead] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [favorite, setFavorite] = useState(false);
  const [summaryLang, setSummaryLang] = useState<SummaryLanguage>("en");
  const [summaryText, setSummaryText] = useState("");
  const [summaryStatus, setSummaryStatus] = useState<string>("pending");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summarizing, setSummarizing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const row = await getEbookById(ebookId);
        if (!cancelled) setBook(row);
      } catch (err) {
        if (!cancelled) setToast({ kind: "error", message: getApiErrorMessage(err) });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [ebookId]);

  useEffect(() => {
    let cancelled = false;
    const loadFavorites = async () => {
      try {
        const favorites = await getFavorites();
        if (!cancelled) {
          setFavorite(favorites.some((f) => f.ebook.ebook_id === ebookId));
        }
      } catch {
        // non-blocking
      }
    };
    if (Number.isFinite(ebookId) && ebookId > 0) void loadFavorites();
    return () => {
      cancelled = true;
    };
  }, [ebookId]);

  const loadCachedSummary = useCallback(
    async (lang: SummaryLanguage) => {
      if (!book) return;
      try {
        setSummaryLoading(true);
        const result = await getEbookSummary(book.ebook_id, { lang, cachedOnly: true });
        setSummaryText(result.ai_summary);
        setSummaryStatus(result.summary_status);
      } catch {
        // Non-blocking: cached summary may be unavailable on a busy cloud host.
      } finally {
        setSummaryLoading(false);
      }
    },
    [book]
  );

  useEffect(() => {
    if (!book) return;
    void loadCachedSummary(summaryLang);
  }, [book, summaryLang, loadCachedSummary]);

  const handleRead = async () => {
    if (!book?.pdf_available) {
      setToast({ kind: "error", message: "No PDF available for this e-book." });
      return;
    }
    try {
      await openEbookPdf(book.ebook_id);
    } catch (err) {
      setToast({ kind: "error", message: getApiErrorMessage(err) });
      return;
    }
    if (trackingRead) return;
    try {
      setTrackingRead(true);
      const result = await trackEbookRead(book.ebook_id);
      setBook((prev) => (prev ? { ...prev, read_count: Math.max(prev.read_count, result.readCount) } : prev));
    } catch {
      // don't block reading when analytics tracking fails
    } finally {
      setTrackingRead(false);
    }
  };

  const handleDownload = async () => {
    if (!book?.pdf_available) {
      setToast({ kind: "error", message: "No PDF available for this e-book." });
      return;
    }
    try {
      await downloadEbookPdf(book.ebook_id, book.ebook_name || "ebook");
    } catch (err) {
      setToast({ kind: "error", message: getApiErrorMessage(err) });
    }
  };

  const handleFavorite = async () => {
    if (!book) return;
    try {
      const result = await toggleFavorite(book.ebook_id);
      setFavorite(result.favorited);
      setToast({
        kind: "success",
        message: result.favorited ? "Added to favorites." : "Removed from favorites."
      });
    } catch (err) {
      setToast({ kind: "error", message: getApiErrorMessage(err) });
    }
  };

  const handleSummarize = async () => {
    if (!book) return;
    try {
      setSummarizing(true);
      setToast(null);
      setSummaryStatus("processing");
      const result = await generateEbookSummary(book.ebook_id, { lang: summaryLang });
      setSummaryText(result.ai_summary);
      setSummaryStatus(result.summary_status);
      setToast({
        kind: "success",
        message:
          result.source === "database"
            ? "Loaded saved summary."
            : "PDF summary generated successfully."
      });
    } catch (err) {
      setSummaryStatus("failed");
      setToast({ kind: "error", message: getApiErrorMessage(err) });
    } finally {
      setSummarizing(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200/60 bg-white/70 p-8 text-center text-sm text-slate-500 shadow-lg backdrop-blur-md dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300">
        Loading e-book detail...
      </div>
    );
  }

  if (!book) {
    return (
      <div className="space-y-4">
        <Link
          to={backToEbooksPath}
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to e-Books
        </Link>
        <div className="rounded-2xl border border-slate-200/60 bg-white/70 p-8 text-center text-sm text-slate-500 shadow-lg backdrop-blur-md dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300">
          e-Book not found.
        </div>
      </div>
    );
  }

  const outlineBtn =
    "inline-flex items-center justify-center gap-2 rounded-xl border border-primary bg-white px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/5 disabled:pointer-events-none disabled:opacity-55 dark:bg-slate-900 dark:hover:bg-primary/10";

  return (
    <div className="space-y-6">
      <Link
        to={backToEbooksPath}
        className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to e-Books
      </Link>
      {toast && (
        <div
          className={`rounded-xl border px-3 py-2 text-sm ${
            toast.kind === "error"
              ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-200"
              : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
          }`}
        >
          {toast.message}
        </div>
      )}

      <motion.section
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-slate-200/60 bg-white/70 p-6 shadow-lg backdrop-blur-md dark:border-slate-700 dark:bg-slate-800/70"
      >
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="mx-auto w-full max-w-[260px] shrink-0 overflow-hidden rounded-2xl border border-slate-200/70 bg-slate-50 dark:border-slate-700 dark:bg-slate-900 lg:mx-0">
            {book.cover_image ? (
              <img
                src={buildCoverThumbnailUrl(book.cover_image, { width: 420, quality: 72 })}
                alt={book.ebook_name}
                className="aspect-[2/3] w-full object-cover transition-transform duration-300 hover:scale-105"
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                data-retry="0"
                onError={(e) => {
                  const img = e.currentTarget as HTMLImageElement;
                  const retry = Number(img.dataset.retry || "0");
                  const source = buildCoverThumbnailUrl(book.cover_image, { width: 420, quality: 72 });
                  if (source && retry < COVER_RETRY_MAX) {
                    const next = retry + 1;
                    img.dataset.retry = String(next);
                    img.src = withRetryBuster(source, next);
                    return;
                  }
                  img.src = FALLBACK_COVER;
                }}
              />
            ) : (
              <div className="flex aspect-[2/3] items-center justify-center text-sm font-semibold text-slate-500 dark:text-slate-300">
                No Cover
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-4">
            <div>
              <h2 className="text-3xl font-bold text-slate-800 dark:text-white">{book.ebook_name}</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                by {book.author_name || "Unknown author"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 dark:text-slate-300">
              <span>
                <strong>Category:</strong> {book.category_name || "-"}
              </span>
              <span>
                <strong>Reads:</strong> {book.read_count}
              </span>
              {book.read_count > 10 && (
                <span className="inline-block rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300">
                  Popular
                </span>
              )}
            </div>

            <div className="rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-600 dark:bg-slate-900 dark:text-slate-300">
              {book.description || "No description available."}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button type="button" onClick={() => void handleRead()}>
                Read Now
              </Button>
              <button type="button" className={outlineBtn} onClick={handleDownload}>
                <Download className="h-4 w-4" aria-hidden />
                Download
              </button>
              <button type="button" className={outlineBtn} onClick={() => void handleFavorite()}>
                <Heart className={`h-4 w-4 ${favorite ? "fill-current" : ""}`} aria-hidden />
                Favorite
              </button>
              {trackingRead && <span className="text-xs text-slate-400">Updating read count...</span>}
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-3 border-t border-slate-200/70 pt-6 dark:border-slate-700">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Summary language</p>
          <div className="flex flex-wrap gap-2">
            {SUMMARY_LANG_OPTIONS.map((option) => {
              const selected = summaryLang === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={summarizing}
                  onClick={() => setSummaryLang(option.value)}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition disabled:opacity-55 ${
                    selected
                      ? "border-primary/30 bg-primary/10 text-primary dark:bg-primary/20"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
                  }`}
                >
                  {selected && <Check className="h-4 w-4" aria-hidden />}
                  {option.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className={`${outlineBtn} w-full sm:w-auto`}
            disabled={summarizing || !book.pdf_available}
            onClick={() => void handleSummarize()}
          >
            <FileText className="h-4 w-4" aria-hidden />
            {summarizing ? "Summarizing PDF..." : "Summarize PDF"}
          </button>

          {(summaryLoading || summarizing) && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {summarizing
                ? "Generating summary with AI. This usually takes under a minute..."
                : "Loading saved summary..."}
            </p>
          )}

          {summaryStatus === "failed" && !summaryText && !summarizing && (
            <p className="text-sm text-rose-600 dark:text-rose-300">
              Summary generation failed. Try again or choose another language.
            </p>
          )}

          {summaryText && (
            <div className="rounded-xl border border-slate-200/70 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
              <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">AI Summary</h3>
              <p
                className={`whitespace-pre-wrap text-sm leading-relaxed text-slate-600 dark:text-slate-300 ${
                  summaryLang === "my" ? "font-[Padauk,'Myanmar Text',sans-serif]" : ""
                }`}
              >
                {summaryText}
              </p>
            </div>
          )}
        </div>
      </motion.section>
    </div>
  );
};

export default EbookDetail;
