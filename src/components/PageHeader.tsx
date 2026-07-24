import Link from 'next/link';
import type { ReactNode } from 'react';

import { Avatar } from '@/components/ui/Avatar';

/**
 * En-tête collant commun à toutes les pages : titre à gauche, action à droite,
 * et raccourci vers les réglages via l'avatar.
 */
export function PageHeader({
  title,
  subtitle,
  action,
  user,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  user?: { id: string; display_name: string; avatar_color: string };
}) {
  return (
    <header className="safe-top sticky top-0 z-30 -mx-4 mb-4 border-b border-line/70 bg-bg/85 px-4 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3 py-3">
        <div className="min-w-0">
          <h1 className="truncate text-[22px] font-semibold tracking-[-0.01em] text-ink">
            {title}
          </h1>
          {subtitle && <p className="mt-0.5 truncate text-[13px] text-muted">{subtitle}</p>}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {action}
          {user && (
            <Link href="/settings" aria-label="Réglages" className="rounded-full">
              <Avatar
                id={user.id}
                name={user.display_name}
                color={user.avatar_color}
                size="sm"
              />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
