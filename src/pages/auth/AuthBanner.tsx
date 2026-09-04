import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, CheckCircle2, X } from "lucide-react";

type AuthBannerProps = {
  kind: "success" | "error";
  message: string;
  onDismiss?: () => void;
};

const styles = {
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100",
  error:
    "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-100"
};

const AuthBanner = ({ kind, message, onDismiss }: AuthBannerProps) => (
  <AnimatePresence>
    {message ? (
      <motion.div
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        role="alert"
        className={`mb-4 flex items-start gap-3 rounded-xl border px-3 py-2.5 text-sm ${styles[kind]}`}
      >
        {kind === "success" ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        ) : (
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        )}
        <p className="flex-1 leading-relaxed">{message}</p>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 rounded-lg p-0.5 opacity-70 transition hover:opacity-100"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </motion.div>
    ) : null}
  </AnimatePresence>
);

export default AuthBanner;
