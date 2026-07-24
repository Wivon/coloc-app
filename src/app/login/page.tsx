import type { Metadata } from 'next';
import Image from 'next/image';
import { redirect } from 'next/navigation';

import { AuthForm } from '@/components/auth/AuthForm';
import { InstallHint } from '@/components/InstallHint';
import { getCurrentUser } from '@/lib/domain/households';

export const metadata: Metadata = { title: 'Connexion' };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect('/tasks');

  return (
    <main className="safe-top mx-auto flex min-h-dvh w-full max-w-[400px] flex-col justify-center px-6 py-10">
      <div className="mb-8">
        <Image
          src="/icon-192.png"
          alt=""
          width={52}
          height={52}
          className="mb-5 rounded-[14px]"
          priority
        />
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em] text-ink">
          La coloc, sans les prises de tête.
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          Les tâches se répartissent toutes seules, les dépenses se partagent en deux gestes.
        </p>
      </div>

      <AuthForm />

      <p className="mt-6 text-center text-[13px] leading-relaxed text-subtle">
        Pas de mot de passe : votre compte est protégé par une passkey, avec Face&nbsp;ID ou
        l’empreinte de votre appareil.
      </p>

      <InstallHint className="mt-8" />
    </main>
  );
}
