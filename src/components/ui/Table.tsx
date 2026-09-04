import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { ReactNode } from "react";

export type TableColumn<T extends Record<string, unknown>> = {
  key: keyof T;
  title: string;
  /** When set, replaces the plain `title` text in the header (e.g. filters). */
  headerCell?: ReactNode;
  render?: (row: T) => ReactNode;
  /** Enables Excel-style sort for this column (ignored for `_actions`). */
  sortable?: boolean;
};

type TableProps<T extends Record<string, unknown>> = {
  columns: TableColumn<T>[];
  data: T[];
  /** When `data` is empty, show one row with this message (headers stay visible). */
  emptyMessage?: string;
  sortKey?: string | null;
  sortOrder?: "asc" | "desc";
  onSortClick?: (key: string) => void;
  /** Global row index offset for paginated tables (default 0 → No. starts at 1). */
  rowNumberBase?: number;
};

function SortGlyph({
  active,
  order,
}: {
  active: boolean;
  order: "asc" | "desc";
}) {
  if (!active) {
    return (
      <ArrowUpDown
        className="h-3.5 w-3.5 shrink-0 opacity-40"
        aria-hidden
      />
    );
  }
  return order === "asc" ? (
    <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
  ) : (
    <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
  );
}

export function Table<T extends Record<string, unknown>>({
  columns,
  data,
  emptyMessage,
  sortKey = null,
  sortOrder = "asc",
  onSortClick,
  rowNumberBase = 0,
}: TableProps<T>) {
  const keyStr = (k: keyof T) => String(k);

  const renderHeaderCell = (col: TableColumn<T>) => {
    const k = keyStr(col.key);
    const sortable =
      Boolean(col.sortable && onSortClick && k !== "_actions");
    const active = sortKey === k;

    const sortButton = sortable ? (
      <button
        type="button"
        className="inline-flex shrink-0 items-center justify-center rounded-full p-1 text-slate-500 transition hover:bg-slate-200/80 hover:text-primary dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
        onClick={(e) => {
          e.stopPropagation();
          onSortClick!(k);
        }}
        aria-label={`Sort by ${col.title}`}
      >
        <SortGlyph active={active} order={sortOrder} />
      </button>
    ) : null;

    if (col.headerCell) {
      return (
        <div className="flex items-center gap-1.5">
          {sortButton}
          <div className="min-w-0 flex-1">{col.headerCell}</div>
        </div>
      );
    }

    if (sortable) {
      return (
        <button
          type="button"
          className="inline-flex w-full items-center gap-1.5 rounded-lg py-0.5 text-left font-semibold text-slate-500 transition hover:text-primary dark:text-slate-300 dark:hover:text-white"
          onClick={() => onSortClick!(k)}
        >
          <span>{col.title}</span>
          <SortGlyph active={active} order={sortOrder} />
        </button>
      );
    }

    return col.title;
  };

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          <tr>
            <th className="w-16 px-4 py-3 font-semibold">No.</th>
            {columns.map((col) => (
              <th key={keyStr(col.key)} className="px-4 py-3 font-semibold">
                {renderHeaderCell(col)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 && emptyMessage ? (
            <tr>
              <td
                colSpan={columns.length + 1}
                className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr
                key={i}
                className="border-b border-slate-100 last:border-0 dark:border-slate-700"
              >
                <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                  {rowNumberBase + i + 1}
                </td>
                {columns.map((col) => (
                  <td
                    key={keyStr(col.key)}
                    className="px-4 py-3 text-slate-700 dark:text-slate-200"
                  >
                    {col.render ? col.render(row) : String(row[col.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
