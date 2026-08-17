import { forwardRef, useId, type SelectHTMLAttributes } from 'react';

import styles from './Select.module.scss';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: SelectOption[];
  error?: string;
  placeholder?: string;
}

/**
 * A native `<select>`, deliberately.
 *
 * A custom dropdown means reimplementing keyboard navigation, type-ahead, focus trapping, screen
 * reader semantics, and mobile behaviour — and getting all of that right is a week's work that a
 * native element already does. The design system doc's rule applies: a shared component is justified
 * when it abstracts shared *behaviour*, not to make something look different.
 *
 * `forwardRef` for the same reason as Input: React Hook Form's `register()` attaches a ref.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, options, error, placeholder, id, className, ...rest },
  ref,
) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const errorId = `${selectId}-error`;

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={selectId}>
        {label}
      </label>

      <select
        ref={ref}
        id={selectId}
        className={[styles.select, error ? styles.hasError : '', className ?? '']
          .filter(Boolean)
          .join(' ')}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...rest}
      >
        {placeholder && (
          // Empty value so a required field genuinely fails validation while this is selected.
          // A placeholder with a real value would silently submit as a legitimate choice.
          <option value="">{placeholder}</option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {error && (
        <span className={styles.error} id={errorId} role="alert">
          {error}
        </span>
      )}
    </div>
  );
});
