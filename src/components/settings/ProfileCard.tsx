'use client';

import { useState } from 'react';

import { updateProfileAction } from '@/actions/household';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { Field, FormError, Input } from '@/components/ui/Field';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { AVATAR_COLORS } from '@/lib/avatar';
import { cn } from '@/lib/cn';
import { useFormAction } from '@/lib/use-form-action';

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
  const [saved, setSaved] = useState(false);

  const { submit, error } = useFormAction(updateProfileAction, () => setSaved(true));

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
                onChange={(event) => {
                  setName(event.target.value);
                  setSaved(false);
                }}
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
                onClick={() => {
                  setColor(option);
                  setSaved(false);
                }}
                className={cn(
                  'size-8 rounded-full transition',
                  color === option ? 'ring-2 ring-ink ring-offset-2 ring-offset-surface' : '',
                )}
                style={{ backgroundColor: `var(--avatar-${option})` }}
              />
            ))}
          </div>
        </div>

        <FormError>{error}</FormError>
        {saved ? <p className="text-[13px] text-positive">Profil mis à jour.</p> : null}

        <SubmitButton size="md" variant="secondary" pendingLabel="Enregistrement…">
          Enregistrer
        </SubmitButton>
      </form>
    </Card>
  );
}
