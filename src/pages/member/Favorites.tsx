import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../components/ui/Button";
import { FavoriteItem, getApiErrorMessage, getFavorites } from "../../services/api";

type Toast = { kind: "success" | "error"; message: string } | null;

const Favorites = () => {
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<Toast>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const rows = await getFavorites();
        if (!cancelled) setFavorites(rows);
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
  }, []);

  return (
    <div className="space-y-6">
      <motion.div initial={false} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">My Favorites</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Your saved e-books in one place.</p>
      </motion.div>

      {toast && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-200">
          {toast.message}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }, (_, i) => i).map((item) => (
            <div
              key={item}
              className="animate-pulse rounded-2xl border border-slate-200/60 bg-white/70 p-3 shadow-lg backdrop-blur-md dark:border-slate-700 dark:bg-slate-800/70"
            >
              <div className="mb-3 aspect-[3/4] rounded-xl bg-slate-200 dark:bg-slate-700" />
              <div className="h-4 w-4/5 rounded bg-slate-200 dark:bg-slate-700" />
              <div className="mt-2 h-3 w-1/2 rounded bg-slate-200 dark:bg-slate-700" />
            </div>
          ))}
        </div>
      ) : favorites.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/60 bg-white/70 p-8 text-center text-sm text-slate-500 shadow-lg backdrop-blur-md dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300">
          No books found.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {favorites.map((favorite, idx) => (
            <motion.div
              key={favorite.favorite_id}
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.02 }}
              className="rounded-2xl border border-slate-200/60 bg-white/70 p-3 shadow-lg backdrop-blur-md transition hover:scale-105 hover:shadow-xl dark:border-slate-700 dark:bg-slate-800/70"
            >
              <div className="mb-3 aspect-[3/4] overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-700/70">
                {favorite.ebook.cover_image ? (
                  <img src={favorite.ebook.cover_image} alt={favorite.ebook.ebook_name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs font-semibold text-slate-500 dark:text-slate-300">
                    No Cover
                  </div>
                )}
              </div>
              <p className="line-clamp-2 text-sm font-semibold text-slate-800 dark:text-slate-100">{favorite.ebook.ebook_name}</p>
              <p className="mt-1 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
                {favorite.ebook.author_name || "Unknown author"}
              </p>
              <Button
                type="button"
                className="mt-3 w-full justify-center"
                onClick={() => navigate(`/member/ebooks/${favorite.ebook.ebook_id}`)}
              >
                See Detail
              </Button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Favorites;

