'use client';

import { useState, useTransition } from 'react';

import { regenerateApiTokenAction } from '@/actions/api';
import { Button, buttonClass } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useCopy } from '@/lib/use-copy';

/**
 * Accès à l'API personnelle : l'adresse, le jeton, et la documentation.
 *
 * Contrairement au lien MCP, l'adresse et le jeton sont séparés : l'adresse est
 * publique et se colle dans le code, le jeton est secret et va dans l'en-tête
 * `Authorization` — ou mieux, dans une variable d'environnement. Le jeton est
 * donc masqué par défaut ; « Copier » n'a pas besoin qu'il soit affiché.
 */
export function ApiCard({ baseUrl, token: initialToken }: { baseUrl: string; token: string }) {
  const [token, setToken] = useState(initialToken);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { copy, copied, reset } = useCopy();

  async function copyValue(value: string, key: 'url' | 'token') {
    if (await copy(value, key)) return setError(null);
    // Presse-papiers refusé : reste la valeur à l'écran, à sélectionner à la main.
    if (key === 'token') setRevealed(true);
    setError('Copie impossible : sélectionnez la valeur à la main.');
  }

  function regenerate() {
    if (!confirm('Régénérer le jeton ? Les scripts qui utilisent l’ancien cesseront aussitôt de fonctionner.')) {
      return;
    }

    startTransition(async () => {
      const result = await regenerateApiTokenAction();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setToken(result.data);
      setError(null);
      reset();
    });
  }

  return (
    <Card>
      <h2 className="text-[15px] font-semibold text-ink">API personnelle</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-muted">
        Récupérez les dépenses, soldes et tâches de la coloc depuis un script, un
        tableur ou un raccourci. Lecture seule.
      </p>

      <p className="mb-1.5 mt-4 text-[13px] font-medium text-muted">Adresse</p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-xl bg-sunken px-3 py-3 text-[12.5px] text-ink">
          {baseUrl}
        </code>
        <Button variant="secondary" size="md" onClick={() => copyValue(baseUrl, 'url')}>
          {copied === 'url' ? 'Copié' : 'Copier'}
        </Button>
      </div>

      <div className="mb-1.5 mt-4 flex items-baseline justify-between">
        <p className="text-[13px] font-medium text-muted">Jeton</p>
        <button
          type="button"
          onClick={() => setRevealed((value) => !value)}
          className="text-[13px] text-muted underline underline-offset-2"
        >
          {revealed ? 'Masquer' : 'Afficher'}
        </button>
      </div>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-xl bg-sunken px-3 py-3 text-[12.5px] text-ink">
          {revealed ? token : maskToken(token)}
        </code>
        <Button variant="secondary" size="md" onClick={() => copyValue(token, 'token')}>
          {copied === 'token' ? 'Copié' : 'Copier'}
        </Button>
      </div>

      <p className="mt-2 text-[12.5px] leading-relaxed text-subtle">
        À envoyer dans l’en-tête{' '}
        <code className="whitespace-nowrap text-[12px] text-muted">Authorization: Bearer …</code>
      </p>

      <div className="mt-4 flex items-center justify-between gap-3">
        {/* Lien plutôt que bouton : le navigateur gère le téléchargement, et
            l'attribut `download` impose le nom du fichier. */}
        <a href="/api/v1/docs" download="colocapp-api.md" className={buttonClass('secondary', 'sm')}>
          <svg viewBox="0 0 20 20" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path d="M10 3v10m0 0l-4-4m4 4l4-4M4 16h12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Documentation (.md)
        </a>
        <Button variant="danger" size="sm" onClick={regenerate} disabled={pending}>
          {pending ? 'Régénération…' : 'Régénérer'}
        </Button>
      </div>

      <p className="mt-3 text-[12.5px] leading-relaxed text-subtle">
        Ce jeton vaut mot de passe : qui l’a peut lire tous les comptes de la
        coloc. Ne le partagez pas — régénérez-le s’il a fuité.
      </p>

      {error ? <p className="mt-2 text-[13px] text-negative">{error}</p> : null}
    </Card>
  );
}

/** Garde le préfixe et les 4 derniers caractères — assez pour voir qu'il a changé. */
function maskToken(token: string): string {
  const prefix = token.slice(0, token.indexOf('_') + 1);
  return `${prefix}${'•'.repeat(8)}${token.slice(-4)}`;
}
