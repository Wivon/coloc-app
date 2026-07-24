'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/cn';

const TABS = [
  { href: '/tasks', label: 'Tâches', icon: CheckIcon },
  { href: '/expenses', label: 'Dépenses', icon: ReceiptIcon },
  { href: '/balances', label: 'Comptes', icon: ScaleIcon },
  { href: '/insights', label: 'Insights', icon: ChartIcon },
] as const;

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/85 pt-1 backdrop-blur-xl">
      <ul className="mx-auto flex w-full max-w-[560px] items-stretch">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const Icon = tab.icon;

          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-xl py-1.5 transition',
                  active ? 'text-accent' : 'text-subtle',
                )}
              >
                <Icon filled={active} />
                <span className="text-[11px] font-medium">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

type IconProps = { filled?: boolean };

function iconProps(filled?: boolean) {
  return {
    viewBox: '0 0 24 24',
    className: 'size-[22px]',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: filled ? 2.1 : 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
}

function CheckIcon({ filled }: IconProps) {
  return (
    <svg {...iconProps(filled)} aria-hidden>
      <rect x="3.5" y="4.5" width="17" height="16" rx="4" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" />
    </svg>
  );
}

function ReceiptIcon({ filled }: IconProps) {
  return (
    <svg {...iconProps(filled)} aria-hidden>
      <path d="M5.5 3.5h13v17l-2.2-1.6-2.2 1.6-2.1-1.6-2.2 1.6-2.3-1.6z" />
      <path d="M9 9h6M9 13h4" />
    </svg>
  );
}

function ScaleIcon({ filled }: IconProps) {
  return (
    <svg {...iconProps(filled)} aria-hidden>
      <path d="M12 4v16M6 8h12" />
      <path d="M6 8l-2.5 5.5h5zM18 8l-2.5 5.5h5z" />
    </svg>
  );
}

function ChartIcon({ filled }: IconProps) {
  return (
    <svg {...iconProps(filled)} aria-hidden>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  );
}
