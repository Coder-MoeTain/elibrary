type ToastKind = "success" | "error" | "warning";

type ToastBannerProps = {
  kind: ToastKind;
  message: string;
};

const styles: Record<ToastKind, string> = {
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200",
  error: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-200",
  warning:
    "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-100"
};

const ToastBanner = ({ kind, message }: ToastBannerProps) => (
  <div className={`rounded-xl border px-3 py-2 text-sm ${styles[kind]}`} role="status">
    {message}
  </div>
);

export default ToastBanner;
