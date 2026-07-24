'use client';

import { useActionState, useState } from 'react';

import { updateProfileAction } from '@/actions/household';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { Field, FormError, Input } from '@/components/ui/Field';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { AVATAR_COLORS } from '@/lib/avatar';
import { cn } from '@/lib/cn';
import type { ActionResult } from '@/lib/action-result';

const initial: ActionResult<void> | null = null;

export function ProfileCard({
  userId,
  displayName,
  avatarColor,
  email,
}: {
  userId: string;
  displayName: string;
  avatarColor: string;
  email: string;
}) {
  const [color, setColor] = useState(avatarColor);
  const [name, setName] = useState(displayName);

  const [state, submit] = useActionState(
    (_state: typeof initial, formData: FormData) => updateProfileAction(formData),
    initial,
  );

  return (
    <Card>
      <h2 className="text-[15px] font-semibold text-ink">Profil</h2>
      <p className="mt-0.5 text-[13px] text-muted">{email}</p>

      <form action={submit} className="mt-4 flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <Avatar id={userId} name={name || '?'} color={color} size="lg" />
          <div className="flex-1">
            <Field label="Prénom">
              <Input
                name="displayName"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                minLength={1}
              />
            </Field>
          </div>
        </div>

        <div>
          <p className="mb-2 text-[13px] font-medium text-muted">Couleur</p>
          <input type="hidden" name="avatarColor" value={color} />
          <div className="flex flex-wrap gap-2">
            {AVATAR_COLORS.map((option) => (
              <button
                key={option}
                type="button"
                aria-label={option}
                aria-pressed={color === option}
                onClick={() => setColor(option)}
                className={cn(
                  'size-8 rounded-full transition',
                  color === option ? 'ring-2 ring-ink ring-offset-2 ring-offset-surface' : '',
                )}
                style={{ backgroundColor: `var(--avatar-${option})` }}
              />
            ))}
          </div>
        </div>

        {!state?.ok && <FormError>{state?.error}</FormError>}
        {state?.ok && <p className="text-[13px] text-positive">Profil mis à jour.</p>}

        <SubmitButton size="md" variant="secondary" pendingLabel="Enregistrement…">
          Enregistrer
        </SubmitButton>
      </form>
    </Card>
  );
}
