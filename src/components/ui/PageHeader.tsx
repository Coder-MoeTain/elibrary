import { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
};

const PageHeader = ({ title, description, actions }: PageHeaderProps) => (
  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div className="min-w-0">
      <h2 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-white">{title}</h2>
      {description ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p> : null}
    </div>
    {actions ? <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">{actions}</div> : null}
  </div>
);

export default PageHeader;
