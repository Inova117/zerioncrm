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

  useEffect(() => {
    if (!open) return;
    // Remember what had focus, move focus into the dialog, and trap Tab within it
    // so keyboard users don't wander behind the modal. (bug #21)
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusables = () =>
      Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        ) ?? []
      ).filter((el) => el.offsetParent !== null);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
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
    // Focus the first field/button (fall back to the dialog itself).
    requestAnimationFrame(() => {
      const items = focusables();
      (items[0] ?? dialogRef.current)?.focus();
    });

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

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
