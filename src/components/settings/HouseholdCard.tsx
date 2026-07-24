'use client';

import { useActionState } from 'react';

import { renameHouseholdAction } from '@/actions/household';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { Field, FormError, Input } from '@/components/ui/Field';
import { SubmitButton } from '@/components/ui/SubmitButton';
import type { ActionResult } from '@/lib/action-result';
import type { Member } from '@/lib/domain/households';

const initial: ActionResult<void> | null = null;

export function HouseholdCard({ name, members }: { name: string; members: Member[] }) {
  const [state, submit] = useActionState(
    (_state: typeof initial, formData: FormData) => renameHouseholdAction(formData),
    initial,
  );

  return (
    <Card>
      <h2 className="text-[15px] font-semibold text-ink">Colocation</h2>

      <form action={submit} className="mt-3 flex flex-col gap-3">
        <Field label="Nom">
          <Input name="name" defaultValue={name} required minLength={2} />
        </Field>
        {!state?.ok && <FormError>{state?.error}</FormError>}
        <SubmitButton size="md" variant="secondary" pendingLabel="Enregistrement…">
          Renommer
        </SubmitButton>
      </form>

      <p className="mb-2 mt-5 text-[13px] font-medium text-muted">
        {members.length} coloc{members.length > 1 ? 's' : ''}
      </p>
      <ul className="flex flex-col divide-y divide-line border-t border-line">
        {members.map((member) => (
          <li key={member.id} className="flex items-center gap-3 py-2.5">
            <Avatar
              id={member.id}
              name={member.displayName}
              color={member.avatarColor}
              size="sm"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14.5px] text-ink">{member.displayName}</span>
              <span className="block truncate text-[12.5px] text-subtle">{member.email}</span>
            </span>
            {member.role === 'owner' && (
              <span className="text-[12px] text-subtle">Créateur</span>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
