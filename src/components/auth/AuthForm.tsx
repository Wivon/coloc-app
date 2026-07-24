'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { browserSupportsWebAuthn } from '@simplewebauthn/browser';

import { Button } from '@/components/ui/Button';
import { Field, FormError, Input } from '@/components/ui/Field';
import { describeAuthError, signInWithPasskey, signUpWithPasskey } from '@/lib/auth/client';

type Mode = 'signin' | 'signup';

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => setSupported(browserSupportsWebAuthn()), []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      if (mode === 'signup') await signUpWithPasskey(email, displayName);
      else await signInWithPasskey(email);

      router.replace('/tasks');
      router.refresh();
    } catch (cause) {
      setError(describeAuthError(cause));
      setPending(false);
    }
  }

  if (!supported) {
    return (
      <FormError>
        Ce navigateur ne gère pas les passkeys. Sur iPhone, ouvrez ColocApp avec Safari.
      </FormError>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      {mode === 'signup' && (
        <Field label="Prénom">
          <Input
            name="displayName"
            autoComplete="given-name"
            placeholder="Camille"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            required
          />
        </Field>
      )}

      <Field label="Email">
        <Input
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username webauthn"
          placeholder="camille@exemple.fr"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </Field>

      <FormError>{error}</FormError>

      <Button type="submit" size="lg" disabled={pending} className="mt-1">
        {pending
          ? 'Passkey en cours…'
          : mode === 'signup'
            ? 'Créer mon compte'
            : 'Se connecter'}
      </Button>

      <p className="mt-1 text-center text-[14px] text-muted">
        {mode === 'signup' ? 'Vous avez déjà un compte ?' : 'Première fois ici ?'}{' '}
        <button
          type="button"
          onClick={() => {
            setMode(mode === 'signup' ? 'signin' : 'signup');
            setError(null);
          }}
          className="font-medium text-accent underline-offset-4 hover:underline"
        >
          {mode === 'signup' ? 'Se connecter' : 'Créer un compte'}
        </button>
      </p>
    </form>
  );
}
