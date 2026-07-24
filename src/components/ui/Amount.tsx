import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/money';

/**
 * Montant formaté. `tone="balance"` colore selon le signe (créance / dette) ;
 * par défaut le montant reste neutre pour ne pas transformer chaque dépense en
 * alerte rouge.
 */
export function Amount({
  cents,
  currency = 'EUR',
  tone = 'neutral',
  signed = false,
  className,
}: {
  cents: number;
  currency?: string;
  tone?: 'neutral' | 'balance' | 'muted';
  signed?: boolean;
  className?: string;
}) {
  const toneClass =
    tone === 'balance'
      ? cents > 0
        ? 'text-positive'
        : cents < 0
          ? 'text-negative'
          : 'text-muted'
      : tone === 'muted'
        ? 'text-muted'
        : 'text-ink';

  return (
    <span className={cn('tabular', toneClass, className)}>
      {formatMoney(cents, currency, { signed })}
    </span>
  );
}
