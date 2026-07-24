'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';

import { createHouseholdAction, joinHouseholdAction } from '@/actions/household';
import { Field, FormError, Input } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';
import { SubmitButton } from '@/components/ui/SubmitButton';
import type { ActionResult } from '@/lib/action-result';

type Tab = 'create' | 'join';

const initial: ActionResult<string> | null = null;

export function OnboardingForms() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('create');

  const [created, create] = useActionState(
    (_state: typeof initial, formData: FormData) => createHouseholdAction(formData),
    initial,
  );
  const [joined, join] = useActionState(
    (_state: typeof initial, formData: FormData) => joinHouseholdAction(formData),
    initial,
  );

  const result = tab === 'create' ? created : joined;

  useEffect(() => {
    if (result?.ok) {
      router.replace('/tasks');
      router.refresh();
    }
  }, [result, router]);

  return (
    <div className="flex flex-col gap-5">
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'create', label: 'Créer une coloc' },
          { value: 'join', label: 'Rejoindre' },
        ]}
      />

      {tab === 'create' ? (
        <form action={create} className="flex flex-col gap-3">
          <Field label="Nom de la colocation" hint="Vous pourrez le changer plus tard.">
            <Input name="name" placeholder="Rue des Lilas" autoFocus required minLength={2} />
          </Field>
          {!created?.ok && <FormError>{created?.error}</FormError>}
          <SubmitButton pendingLabel="Création…">Créer la colocation</SubmitButton>
        </form>
      ) : (
        <form action={join} className="flex flex-col gap-3">
          <Field label="Code d’invitation" hint="Demandez-le à un coloc, dans ses réglages.">
            <Input
              name="inviteCode"
              placeholder="AB12CD"
              autoCapitalize="characters"
              autoComplete="off"
              className="text-center text-[20px] font-semibold tracking-[0.3em] uppercase"
              required
            />
          </Field>
          {!joined?.ok && <FormError>{joined?.error}</FormError>}
          <SubmitButton pendingLabel="Vérification…">Rejoindre</SubmitButton>
        </form>
      )}
    </div>
  );
}
