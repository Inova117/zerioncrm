import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  footer?: ReactNode;
}

const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' };

export function Modal({ open, onClose, children, title, subtitle, size = 'md', footer }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  // Keep the latest onClose in a ref so the focus effect can depend ONLY on
  // `open`. Otherwise an inline onClose (recreated every parent render) would
  // re-run the whole effect on each keystroke, stealing focus. (bugs #2, #3)
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusables = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        ) ?? []
      ).filter((el) => el.offsetParent !== null);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    // Initial focus: respect a field's autoFocus if React already placed focus
    // inside the dialog; otherwise focus the first NON-close control (never the
    // "Cerrar" X, which is first in the DOM). (bug #3)
    requestAnimationFrame(() => {
      const active = document.activeElement;
      if (active && dialog?.contains(active) && active !== dialog) return;
      const items = focusables().filter((el) => el.getAttribute('aria-label') !== 'Cerrar');
      (items[0] ?? dialog)?.focus();
    });

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-6">
      <div
        className="fixed inset-0 bg-surface-900/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={cn(
          'relative z-10 my-4 w-full rounded-2xl bg-white shadow-pop outline-none animate-scale-in',
          widths[size]
        )}
        role="dialog"
        aria-modal="true"
      >
        {/* Always-available close affordance when there's no header (e.g. lead detail). */}
        {!title && !subtitle && (
          <button
            onClick={onClose}
            className="btn-ghost absolute right-3 top-3 z-10 rounded-lg p-1.5"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        )}
        {(title || subtitle) && (
          <div className="flex items-start justify-between gap-4 border-b border-surface-100 px-6 py-4">
            <div className="min-w-0">
              {title && <h2 className="truncate text-base font-semibold text-surface-900">{title}</h2>}
              {subtitle && <p className="mt-0.5 text-sm text-surface-500">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="btn-ghost -mr-2 -mt-1 rounded-lg p-1.5"
              aria-label="Cerrar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className="px-6 py-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-surface-100 px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
