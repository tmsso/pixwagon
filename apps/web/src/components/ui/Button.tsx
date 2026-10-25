import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Renders a spinner and blocks interaction — used while awaiting server truth. */
  loading?: boolean;
  children: ReactNode;
}

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-ink hover:bg-accent-hover border-transparent',
  secondary: 'bg-surface text-ink border-border hover:bg-surface-sunken',
  ghost: 'bg-transparent text-ink border-transparent hover:bg-surface-sunken',
  danger: 'bg-danger text-white border-transparent hover:brightness-90',
};

const SIZE: Record<ButtonSize, string> = {
  sm: 'text-sm px-3 py-1.5 rounded-md',
  md: 'text-base px-4 py-2.5 rounded-lg',
  lg: 'text-lg px-6 py-3 rounded-lg',
};

/** The button's look as a class string, so a router `<Link>` or a
 *  non-interactive stand-in (a picture of a button) can wear it without a
 *  second copy of these classes drifting from the real thing. */
export function buttonClasses({
  variant = 'primary',
  size = 'md',
  className = '',
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}): string {
  return [
    // min-h-touch keeps every button reachable one-handed on a phone.
    'inline-flex min-h-touch items-center justify-center gap-2 border font-medium',
    'transition-colors duration-fast',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
    'disabled:cursor-not-allowed disabled:opacity-50',
    VARIANT[variant],
    SIZE[size],
    className,
  ].join(' ');
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      className={buttonClasses({ variant, size, className })}
      disabled={disabled === true || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <span aria-hidden className="animate-pulse">
          ◌
        </span>
      ) : null}
      {children}
    </button>
  );
}
