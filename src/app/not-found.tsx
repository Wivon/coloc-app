import { ButtonLink } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[400px] flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="text-3xl" aria-hidden>
        🔎
      </span>
      <h1 className="text-[20px] font-semibold text-ink">Page introuvable</h1>
      <ButtonLink href="/tasks">Retour aux tâches</ButtonLink>
    </main>
  );
}
