import type { ButtonHTMLAttributes, ReactNode } from 'react';

import styles from './Button.module.scss';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  fullWidth?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  fullWidth = false,
  disabled,
  children,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = [
    styles.button,
    styles[variant],
    styles[size],
    fullWidth ? styles.fullWidth : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      // Defaulting to "button", not "submit". A <button> inside a <form> submits it by
      // default, which is a genuinely surprising source of accidental submissions from
      // buttons that were only meant to open a modal.
      type={type}
      className={classes}
      disabled={disabled || isLoading}
      // Tells assistive technology the control is busy. Visually hiding nothing and
      // announcing nothing would leave a screen-reader user with no signal at all.
      aria-busy={isLoading || undefined}
      {...rest}
    >
      {isLoading && <span className={styles.spinner} aria-hidden="true" />}
      {children}
    </button>
  );
}
