import { motion, HTMLMotionProps } from "framer-motion";
import { ReactNode } from "react";

type CardProps = HTMLMotionProps<"div"> & {
  children: ReactNode;
  className?: string;
};

const Card = ({ children, className = "", ...rest }: CardProps) => (
  <motion.div
    whileHover={{ scale: 1.02 }}
    transition={{ type: "spring", stiffness: 400, damping: 25 }}
    className={`rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card dark:border-slate-700 dark:bg-slate-800 ${className}`}
    {...rest}
  >
    {children}
  </motion.div>
);

export default Card;
