import { InputHTMLAttributes } from "react";

const Input = ({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) => (
  <input
    className={`w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white ${className}`}
    {...props}
  />
);

export default Input;
