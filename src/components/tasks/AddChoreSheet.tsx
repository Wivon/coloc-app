'use client';

import { useState } from 'react';

import { addChoreAction } from '@/actions/chores';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Field, FormError, Input } from '@/components/ui/Field';
import { Sheet } from '@/components/ui/Sheet';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { useFormAction } from '@/lib/use-form-action';

/** Modèles courants : un appui suffit pour créer la tâche. */
const PRESETS = [
  { title: 'Vaisselle', emoji: '🍽️', frequencyDays: 2, effort: 2 },
  { title: 'Poubelles', emoji: '🗑️', frequencyDays: 3, effort: 1 },
  { title: 'Sols', emoji: '🧹', frequencyDays: 7, effort: 3 },
  { title: 'Salle de bain', emoji: '🚿', frequencyDays: 7, effort: 3 },
  { title: 'Courses', emoji: '🛒', frequencyDays: 7, effort: 2 },
  { title: 'Cuisine', emoji: '🧽', frequencyDays: 3, effort: 2 },
];

const EMOJIS = ['🧽', '🍽️', '🗑️', '🧹', '🚿', '🛒', '🧺', '🪴', '🐈', '📦'];

const FREQUENCIES = [
  { days: 1, label: 'Tous les jours' },
  { days: 2, label: '2 jours' },
  { days: 7, label: 'Semaine' },
  { days: 14, label: '2 semaines' },
  { days: 30, label: 'Mois' },
];

const EFFORTS = [
  { value: 1, label: 'Rapide' },
  { value: 2, label: 'Normal' },
  { value: 3, label: 'Costaud' },
];

/** Monté uniquement quand la feuille est ouverte (voir `AddChoreButton`). */
export function AddChoreSheet({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState('🧽');
  const [frequencyDays, setFrequencyDays] = useState(7);
  const [effort, setEffort] = useState(2);

  const { submit, error } = useFormAction(addChoreAction, onClose);

  return (
    <Sheet
      open
      onClose={onClose}
      title="Nouvelle tâche"
      description="Elle sera répartie automatiquement entre les colocs, à chaque échéance."
    >
      <form action={submit} className="flex flex-col gap-4">
        <div>
          <p className="mb-2 text-[13px] font-medium text-muted">Modèles</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <Chip
                key={preset.title}
                selected={title === preset.title && emoji === preset.emoji}
                onClick={() => {
                  setTitle(preset.title);
                  setEmoji(preset.emoji);
                  setFrequencyDays(preset.frequencyDays);
                  setEffort(preset.effort);
                }}
              >
                <span aria-hidden>{preset.emoji}</span>
                {preset.title}
              </Chip>
            ))}
          </div>
        </div>

        <Field label="Nom de la tâche">
          <div className="flex gap-2">
            <select
              name="emoji"
              value={emoji}
              onChange={(event) => setEmoji(event.target.value)}
              aria-label="Icône"
              className="w-16 rounded-xl border border-line bg-surface text-center text-[20px]"
            >
              {EMOJIS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <Input
              name="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Sortir les poubelles"
              required
              minLength={2}
            />
          </div>
        </Field>

        <div>
          <p className="mb-2 text-[13px] font-medium text-muted">Fréquence</p>
          <input type="hidden" name="frequencyDays" value={frequencyDays} />
          <div className="flex flex-wrap gap-2">
            {FREQUENCIES.map((frequency) => (
              <Chip
                key={frequency.days}
                selected={frequencyDays === frequency.days}
                onClick={() => setFrequencyDays(frequency.days)}
              >
                {frequency.label}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[13px] font-medium text-muted">
            Charge{' '}
            <span className="font-normal text-subtle">— sert à équilibrer entre colocs</span>
          </p>
          <input type="hidden" name="effort" value={effort} />
          <div className="flex gap-2">
            {EFFORTS.map((option) => (
              <Chip
                key={option.value}
                selected={effort === option.value}
                onClick={() => setEffort(option.value)}
                className="flex-1 justify-center"
              >
                {option.label}
              </Chip>
            ))}
          </div>
        </div>

        <FormError>{error}</FormError>

        <div className="flex flex-col gap-2 pt-1">
          <SubmitButton pendingLabel="Ajout…">Ajouter la tâche</SubmitButton>
          <Button type="button" variant="ghost" size="lg" onClick={onClose}>
            Annuler
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
