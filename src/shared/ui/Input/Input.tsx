import { forwardRef, useId, type InputHTMLAttributes } from 'react';

import styles from './Input.module.scss';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

/**
 * `forwardRef` is not optional here — React Hook Form's `register()` works by attaching a ref to the
 * underlying native input to read its value without re-rendering on every keystroke. A component that
 * swallows the ref cannot be registered, and RHF fails silently: the field simply never appears in
 * the form values, and validation "passes" because there is nothing to validate.
 *
 * (The alternative is `<Controller>`, which drives a fully controlled component instead. Forwarding
 * the ref is cheaper and keeps `register()` available, so both approaches stay open.)
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, id, required, className, ...rest },
  ref,
) {
  // useId gives a stable, SSR-safe unique id. Needed because the <label> must point at this specific
  // input via htmlFor — without that association a screen reader announces an unlabelled field, and
  // clicking the label does not focus the input.
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={inputId}>
        {label}
        {required && (
          <span className={styles.required} aria-hidden="true">
            *
          </span>
        )}
      </label>

      <input
        ref={ref}
        id={inputId}
        className={[styles.input, error ? styles.hasError : '', className ?? '']
          .filter(Boolean)
          .join(' ')}
        // Tells assistive technology the value is rejected. The red border communicates nothing to
        // a screen reader.
        aria-invalid={error ? true : undefined}
        // Points at the error and hint text so they are ANNOUNCED when the field is focused, rather
        // than being visual-only decoration a screen-reader user never encounters.
        aria-describedby={[error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined}
        required={required}
        {...rest}
      />

      {hint && !error && (
        <span className={styles.hint} id={hintId}>
          {hint}
        </span>
      )}

      {error && (
        // role="alert" so the message is announced as soon as it appears, not only when the field
        // regains focus.
        <span className={styles.error} id={errorId} role="alert">
          {error}
        </span>
      )}
    </div>
  );
});
