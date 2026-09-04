import { ReactNode } from "react";

type Props = {
  text: string;
  children: ReactNode;
};

/**
 * Hover/focus tooltip. Wrap disabled controls in a span so hover still works.
 */
export default function Tooltip({ text, children }: Props) {
  return (
    <div className="group relative z-10 inline-block">
      {children}
      <div
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-[200] mb-2 hidden max-w-xs -translate-x-1/2 whitespace-normal rounded-lg bg-slate-900 px-2 py-1 text-left text-xs text-white shadow-lg group-hover:block group-focus-within:block dark:bg-slate-700"
      >
        {text}
      </div>
    </div>
  );
}
