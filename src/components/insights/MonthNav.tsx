import Link from 'next/link';

import { formatMonthLabel, monthKey, startOfMonth, today } from '@/lib/date';

/** Navigation mois par mois. Le mois courant est la borne haute. */
export function MonthNav({ month }: { month: string }) {
  const previous = monthKey(startOfMonth(`${month}-01`, -1));
  const next = monthKey(startOfMonth(`${month}-01`, 1));
  const canGoForward = next <= monthKey(today());

  return (
    <div className="flex items-center justify-between gap-2">
      <MonthLink month={previous} label="Mois précédent" direction="prev" />
      <p className="text-[15px] font-medium capitalize text-ink">{formatMonthLabel(month)}</p>
      {canGoForward ? (
        <MonthLink month={next} label="Mois suivant" direction="next" />
      ) : (
        <span className="size-9" />
      )}
    </div>
  );
}

function MonthLink({
  month,
  label,
  direction,
}: {
  month: string;
  label: string;
  direction: 'prev' | 'next';
}) {
  return (
    <Link
      href={`/insights?m=${month}`}
      aria-label={label}
      className="grid size-9 place-items-center rounded-full text-muted transition hover:bg-sunken hover:text-ink"
    >
      <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path
          d={direction === 'prev' ? 'M12 4l-6 6 6 6' : 'M8 4l6 6-6 6'}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Link>
  );
}
