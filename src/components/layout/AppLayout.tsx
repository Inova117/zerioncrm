import { useState } from 'react';
import type { ReactNode } from 'react';
import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';

interface AppLayoutProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  /** Let the page own scrolling (e.g. the Kanban board that scrolls horizontally). */
  fullBleed?: boolean;
}

export function AppLayout({ title, subtitle, actions, children, fullBleed }: AppLayoutProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex h-full">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-surface-200 bg-white/80 px-4 py-3 backdrop-blur sm:px-6">
          <button
            className="btn-ghost rounded-lg p-2 lg:hidden"
            onClick={() => setMenuOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold text-surface-900">{title}</h1>
            {subtitle && <p className="truncate text-sm text-surface-400">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>

        <main
          className={
            fullBleed
              ? 'min-h-0 flex-1 overflow-hidden'
              : 'min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6'
          }
        >
          {children}
        </main>
      </div>
    </div>
  );
}
