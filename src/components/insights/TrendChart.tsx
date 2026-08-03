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
    // Pas d'`items-end` ici : les colonnes doivent s'étirer sur toute la hauteur.
    // Alignées en bas, elles se réduisaient à la taille de leur contenu, le
    // conteneur de barre en `flex-1` tombait à 0 px et la hauteur en pourcentage
    // de la barre se calculait sur 0 — les libellés s'affichaient, pas les barres.
    <div className="flex h-32 gap-2">
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
            {/* `min-h-0` : sans lui, la hauteur minimale automatique d'un élément
                flex l'empêche de se réduire, et la colonne déborde du graphique. */}
            <div className="flex w-full min-h-0 flex-1 items-end">
              <div
                className={cn(
                  'w-full rounded-md transition-[height]',
                  active ? 'bg-accent' : 'bg-accent/30',
                )}
                style={{ height: `${height}%` }}
                role="presentation"
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
