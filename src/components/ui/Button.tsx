import { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger";
};

const styles = {
  primary: "bg-primary text-white hover:bg-[#26408a]",
  secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-white",
  danger: "bg-rose-500 text-white hover:bg-rose-600"
};

const Button = ({ children, variant = "primary", className = "", ...props }: ButtonProps) => (
  <button
    className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-55 dark:focus-visible:ring-offset-slate-900 ${styles[variant]} ${className}`}
    {...props}
  >
    {children}
  </button>
);

export default Button;
