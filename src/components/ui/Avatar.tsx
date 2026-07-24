import { colorForId, initials, isAvatarColor } from '@/lib/avatar';
import { cn } from '@/lib/cn';

const sizes = {
  xs: 'size-6 text-[10px]',
  sm: 'size-8 text-[11px]',
  md: 'size-10 text-[13px]',
  lg: 'size-14 text-[18px]',
} as const;

export function Avatar({
  id,
  name,
  color,
  size = 'md',
  muted = false,
  className,
}: {
  id: string;
  name: string;
  color?: string;
  size?: keyof typeof sizes;
  /** Rendu atténué, pour les éléments non sélectionnés. */
  muted?: boolean;
  className?: string;
}) {
  const token = color && isAvatarColor(color) ? color : colorForId(id);

  return (
    <span
      aria-hidden
      title={name}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white transition',
        sizes[size],
        muted && 'opacity-35 grayscale',
        className,
      )}
      style={{ backgroundColor: `var(--avatar-${token})` }}
    >
      {initials(name)}
    </span>
  );
}

/** Pile d'avatars pour représenter les participants d'une dépense. */
export function AvatarStack({
  people,
  max = 4,
  size = 'xs',
}: {
  people: { id: string; displayName: string; avatarColor?: string }[];
  max?: number;
  size?: keyof typeof sizes;
}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;

  return (
    <span className="flex items-center -space-x-1.5">
      {shown.map((person) => (
        <Avatar
          key={person.id}
          id={person.id}
          name={person.displayName}
          color={person.avatarColor}
          size={size}
          className="ring-2 ring-surface"
        />
      ))}
      {rest > 0 && (
        <span className="ml-2.5 text-[12px] text-subtle tabular">+{rest}</span>
      )}
    </span>
  );
}
