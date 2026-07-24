import { cn } from '@/lib/cn';
import { formatMonthShort } from '@/lib/date';
import { formatMoney } from '@/lib/money';

/**
 * Histogramme des six derniers mois. Construit en flex plutôt qu'en SVG : il
 * reste net à toutes les largeurs et hérite des couleurs du thème.
 */
export function TrendChart({
  data,
  currency,
  activeMonth,
}: {
  data: { month: string; amountCents: number }[];
  currency: string;
  activeMonth: string;
}) {
  const max = Math.max(1, ...data.map((point) => point.amountCents));

  return (
    <div className="flex h-32 items-end gap-2">
      {data.map((point) => {
        const active = point.month === activeMonth;
        const height = Math.max(2, (point.amountCents / max) * 100);

        return (
          <div key={point.month} className="flex flex-1 flex-col items-center gap-1.5">
            <span
              className={cn(
                'text-[10px] tabular transition',
                active ? 'text-ink' : 'text-transparent',
              )}
            >
              {formatMoney(point.amountCents, currency, { compact: true })}
            </span>
            <div className="flex w-full flex-1 items-end">
              <div
                className={cn(
                  'w-full rounded-md transition-[height]',
                  active ? 'bg-accent' : 'bg-accent/20',
                )}
                style={{ height: `${height}%` }}
              />
            </div>
            <span
              className={cn(
                'text-[11px] capitalize transition',
                active ? 'font-medium text-ink' : 'text-subtle',
              )}
            >
              {formatMonthShort(point.month)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
