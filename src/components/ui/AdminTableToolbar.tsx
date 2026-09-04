import { ReactNode } from "react";

type Props = { children: ReactNode; className?: string };

/** Glass-style bar for search / filters above admin tables. */
const AdminTableToolbar = ({ children, className = "" }: Props) => (
  <div
    className={`mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/60 bg-white/70 p-3 shadow-sm backdrop-blur-md dark:border-slate-700/60 dark:bg-slate-800/70 ${className}`}
  >
    {children}
  </div>
);

export default AdminTableToolbar;
