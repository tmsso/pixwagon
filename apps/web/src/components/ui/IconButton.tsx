import type { ButtonHTMLAttributes, ReactNode } from 'react';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required — an icon-only control with no accessible name is invisible to a screen reader. */
  label: string;
  variant?: 'solid' | 'ghost';
  children: ReactNode;
}

export function IconButton({
  label,
  variant = 'ghost',
  className = '',
  children,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={[
        'inline-flex size-touch items-center justify-center rounded-full border text-lg',
        'transition-colors duration-fast',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'solid'
          ? 'bg-accent text-accent-ink border-transparent'
          : 'bg-transparent text-ink border-border hover:bg-surface-sunken',
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
    </button>
  );
}
