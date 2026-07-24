import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { OnboardingForms } from '@/components/onboarding/OnboardingForms';
import { hasHousehold, requireUser } from '@/lib/domain/households';

export const metadata: Metadata = { title: 'Votre colocation' };

export default async function OnboardingPage() {
  const user = await requireUser();
  if (await hasHousehold(user.id)) redirect('/tasks');

  return (
    <main className="safe-top mx-auto flex min-h-dvh w-full max-w-[400px] flex-col justify-center px-6 py-10">
      <div className="mb-8">
        <p className="text-[13px] font-medium uppercase tracking-wide text-accent">
          Bienvenue {user.display_name}
        </p>
        <h1 className="mt-2 text-[26px] font-semibold leading-tight tracking-[-0.02em] text-ink">
          Une dernière étape.
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          Créez votre colocation, ou rejoignez celle de vos colocs avec leur code.
        </p>
      </div>

      <OnboardingForms />
    </main>
  );
}
