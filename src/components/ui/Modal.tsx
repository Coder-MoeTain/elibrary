import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";

type ModalProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
};

/**
 * Renders in a portal on `document.body` (avoids transform/overflow clipping from layout).
 * Backdrop is vertically scrollable when content + popovers exceed the viewport.
 */
const Modal = ({ open, title, children, onClose }: ModalProps) => {
  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, [open]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[110] overflow-y-auto overflow-x-hidden bg-black/40 overscroll-y-contain"
          initial={false}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="presentation"
        >
          <div className="flex min-h-full w-full items-center justify-center px-4 py-8 sm:px-6 sm:py-10">
            <motion.div
              initial={false}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              className="relative my-auto w-full max-w-lg overflow-visible rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-800"
              role="dialog"
              aria-modal="true"
              aria-labelledby="modal-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 id="modal-title" className="text-lg font-bold text-slate-800 dark:text-white">
                  {title}
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="mb-4 flex justify-center">
                <img
                  src="/App%20Logo.png"
                  alt="MSA Library"
                  className="h-20 w-20 rounded-full border-2 border-gray-400 object-contain sm:h-24 sm:w-24"
                />
              </div>
              {children}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default Modal;
