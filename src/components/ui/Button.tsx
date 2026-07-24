import type { ComponentProps } from 'react';
import Link from 'next/link';

import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 rounded-full font-medium transition ' +
  'disabled:pointer-events-none disabled:opacity-45 active:scale-[0.98]';

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:opacity-90',
  secondary: 'bg-sunken text-ink hover:bg-line',
  ghost: 'text-muted hover:bg-sunken hover:text-ink',
  danger: 'bg-transparent text-negative hover:bg-negative/10',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-[15px]',
  lg: 'h-12 px-5 text-[16px] w-full',
};

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

interface ButtonProps extends ComponentProps<'button'> {
  variant?: Variant;
  size?: Size;
}

export function Button({ variant, size, className, ...props }: ButtonProps) {
  return <button {...props} className={buttonClass(variant, size, className)} />;
}

interface ButtonLinkProps extends ComponentProps<typeof Link> {
  variant?: Variant;
  size?: Size;
}

export function ButtonLink({ variant, size, className, ...props }: ButtonLinkProps) {
  return <Link {...props} className={buttonClass(variant, size, className)} />;
}
