import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";

type DatePickerProps = {
  value?: string;
  onChange: (date: string) => void;
  placeholder?: string;
  required?: boolean;
  /** First year shown in the year dropdown (default: current year − 120). */
  fromYear?: number;
  /** Last year shown in the year dropdown (default: current year + 10). */
  toYear?: number;
};

const shellClass =
  "w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2 text-left text-sm text-slate-700 outline-none transition focus:border-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white";

/** Native <select> must stay invisible — only `.rdp-dropdown_root` + `.rdp-caption_label` are shown (library pattern). */
const dropdownSelectClass =
  "absolute inset-0 z-[2] m-0 h-full min-h-[2.25rem] w-full cursor-pointer appearance-none border-0 bg-transparent p-0 opacity-0";

const dropdownShellClass =
  "relative inline-flex min-h-[2.25rem] min-w-[5.5rem] items-center rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-sm transition hover:border-primary/40 dark:border-slate-600 dark:bg-slate-900/40";

const DatePicker = ({
  value,
  onChange,
  placeholder = "Select date",
  required = false,
  fromYear,
  toYear
}: DatePickerProps) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const yearRange = useMemo(() => {
    const y = new Date().getFullYear();
    return { fromYear: fromYear ?? y - 120, toYear: toYear ?? y + 10 };
  }, [fromYear, toYear]);

  const selectedDate = useMemo(() => {
    if (!value) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }, [value]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  return (
    <div ref={rootRef} className="relative w-full">
      <button
        type="button"
        className={shellClass}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="flex items-center justify-between gap-2">
          <span className={value ? "" : "text-slate-400 dark:text-slate-400"}>
            {value && selectedDate ? format(selectedDate, "yyyy-MM-dd") : placeholder}
          </span>
          <CalendarIcon className="h-4 w-4 text-slate-400" />
        </span>
      </button>

      {required && !value && <input type="text" required className="sr-only" value="" readOnly aria-hidden />}

      {open && (
        <div className="absolute z-[120] mt-2 max-h-none min-h-0 overflow-visible rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-800">
          <DayPicker
            mode="single"
            captionLayout="dropdown"
            hideNavigation
            fromYear={yearRange.fromYear}
            toYear={yearRange.toYear}
            selected={selectedDate}
            className="rdp-root [--rdp-accent-color:#2F4EA2] [--rdp-today-color:#2F4EA2]"
            classNames={{
              months: "relative w-full max-w-none",
              month: "w-full",
              month_caption: "mb-3 flex justify-center",
              dropdowns: "flex flex-wrap items-center justify-center gap-2",
              dropdown: dropdownSelectClass,
              dropdown_root: dropdownShellClass,
              caption_label:
                "pointer-events-none inline-flex items-center gap-1.5 whitespace-nowrap font-medium text-slate-700 dark:text-slate-200",
              chevron: "size-4 shrink-0 text-slate-500 dark:text-slate-400",
              weekday: "text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400",
              day_button:
                "rounded-lg text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700/80"
            }}
            onSelect={(date) => {
              if (!date) return;
              onChange(format(date, "yyyy-MM-dd"));
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
};

export default DatePicker;
