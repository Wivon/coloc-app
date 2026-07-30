'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { createHouseholdAction, joinHouseholdAction } from '@/actions/household';
import { Field, FormError, Input } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { useFormAction } from '@/lib/use-form-action';

type Tab = 'create' | 'join';

export function OnboardingForms() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('create');

  // La redirection est déclenchée par la soumission, pas par un effet : elle ne
  // peut donc pas se rejouer aux rendus suivants.
  function enterApp() {
    router.replace('/tasks');
    router.refresh();
  }

  const create = useFormAction(createHouseholdAction, enterApp);
  const join = useFormAction(joinHouseholdAction, enterApp);

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
        <form action={create.submit} className="flex flex-col gap-3">
          <Field label="Nom de la colocation" hint="Vous pourrez le changer plus tard.">
            <Input name="name" placeholder="Rue des Lilas" autoFocus required minLength={2} />
          </Field>
          <FormError>{create.error}</FormError>
          <SubmitButton pendingLabel="Création…">Créer la colocation</SubmitButton>
        </form>
      ) : (
        <form action={join.submit} className="flex flex-col gap-3">
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
          <FormError>{join.error}</FormError>
          <SubmitButton pendingLabel="Vérification…">Rejoindre</SubmitButton>
        </form>
      )}
    </div>
  );
}
