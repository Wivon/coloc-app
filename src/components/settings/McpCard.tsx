'use client';

import { useState, useTransition } from 'react';

import { regenerateMcpLinkAction } from '@/actions/mcp';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

/**
 * Lien d'endpoint MCP personnel, à coller dans les réglages d'un assistant.
 *
 * Le lien contient le jeton : il est donc masqué par défaut, exactement comme on
 * ne laisse pas une clé d'API à l'écran. Le bouton « Copier » n'a pas besoin
 * qu'il soit affiché, et c'est le geste attendu dans 99 % des cas.
 */
export function McpCard({ endpointUrl }: { endpointUrl: string }) {
  const [url, setUrl] = useState(endpointUrl);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Presse-papiers refusé (contexte non sécurisé) : reste le lien à l'écran.
      setRevealed(true);
      setError('Copie impossible : sélectionnez le lien à la main.');
    }
  }

  function regenerate() {
    if (!confirm('Régénérer le lien ? L’ancien cessera aussitôt de fonctionner.')) return;

    startTransition(async () => {
      const result = await regenerateMcpLinkAction();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setUrl(result.data);
      setError(null);
      setCopied(false);
    });
  }

  return (
    <Card>
      <h2 className="text-[15px] font-semibold text-ink">Connecter votre IA</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-muted">
        Ajoutez ce lien comme connecteur MCP dans Claude (ou tout autre assistant
        compatible) : il pourra alors ajouter vos dépenses, saisir vos
        remboursements et suivre les tâches à votre place.
      </p>

      <div className="mt-4 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-xl bg-sunken px-3 py-3 text-[12.5px] text-ink">
          {revealed ? url : maskToken(url)}
        </code>
        <Button variant="secondary" size="md" onClick={copy}>
          {copied ? 'Copié' : 'Copier'}
        </Button>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setRevealed((value) => !value)}
          className="text-[13px] text-muted underline underline-offset-2"
        >
          {revealed ? 'Masquer' : 'Afficher'}
        </button>
        <Button variant="danger" size="sm" onClick={regenerate} disabled={pending}>
          {pending ? 'Régénération…' : 'Régénérer'}
        </Button>
      </div>

      <p className="mt-3 text-[12.5px] leading-relaxed text-subtle">
        Ce lien vaut mot de passe : qui l’a peut agir en votre nom dans la
        colocation. Ne le partagez pas — régénérez-le s’il a fuité.
      </p>

      {error ? <p className="mt-2 text-[13px] text-negative">{error}</p> : null}
    </Card>
  );
}

/** Ne laisse voir que la fin du jeton — assez pour vérifier qu'il a changé. */
function maskToken(url: string): string {
  const cut = url.lastIndexOf('/');
  if (cut < 0) return url;
  const token = url.slice(cut + 1);
  return `${url.slice(0, cut + 1)}${'•'.repeat(8)}${token.slice(-4)}`;
}
