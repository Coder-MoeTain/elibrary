import { useEffect, useId, useMemo, useState } from "react";

type SelectOption = {
  value: number;
  label: string;
};

type SearchableSelectProps = {
  options: SelectOption[];
  value: number;
  onValueChange: (value: number) => void;
  placeholder: string;
  disabled?: boolean;
  onQueryChange?: (query: string, exactMatch: boolean) => void;
  createHint?: string | null;
  onCreateHintClick?: () => void;
};

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white";

const SearchableSelect = ({
  options,
  value,
  onValueChange,
  placeholder,
  disabled = false,
  onQueryChange,
  createHint,
  onCreateHintClick
}: SearchableSelectProps) => {
  const listId = useId();
  const [query, setQuery] = useState("");

  const labelByValue = useMemo(() => {
    const map = new Map<number, string>();
    for (const option of options) map.set(option.value, option.label);
    return map;
  }, [options]);

  useEffect(() => {
    if (value) {
      const label = labelByValue.get(value) ?? "";
      setQuery(label);
    }
  }, [value, labelByValue]);

  const pickByLabel = (text: string) => {
    const exact = options.find((opt) => opt.label.toLowerCase() === text.trim().toLowerCase());
    if (exact) onValueChange(exact.value);
  };

  return (
    <>
      <input
        list={listId}
        value={query}
        onChange={(e) => {
          const next = e.target.value;
          setQuery(next);
          const trimmed = next.trim();
          const exactOption = options.find(
            (opt) => opt.label.toLowerCase() === trimmed.toLowerCase()
          );
          if (exactOption) {
            onValueChange(exactOption.value);
            onQueryChange?.(trimmed, true);
          } else {
            onValueChange(0);
            onQueryChange?.(trimmed, false);
          }
        }}
        onBlur={() => {
          const exact = options.find((opt) => opt.label.toLowerCase() === query.trim().toLowerCase());
          if (exact) {
            onValueChange(exact.value);
            onQueryChange?.(query.trim(), true);
            return;
          }
          onQueryChange?.(query.trim(), false);
        }}
        placeholder={placeholder}
        className={inputClass}
        disabled={disabled}
        autoComplete="off"
      />
      <datalist id={listId}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.label} />
        ))}
      </datalist>
      {!!createHint && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onCreateHintClick}
          className="mt-1 text-xs font-semibold text-primary hover:underline"
        >
          {createHint}
        </button>
      )}
    </>
  );
};

export default SearchableSelect;
