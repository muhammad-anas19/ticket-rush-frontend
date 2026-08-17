import styles from './Skeleton.module.scss';

export type SkeletonVariant = 'text' | 'block' | 'circle';

export interface SkeletonProps {
  variant?: SkeletonVariant;
  width?: string;
  height?: string;
  /** Render N stacked bars. Only meaningful for the `text` variant. */
  count?: number;
}

/**
 * The mandated loading state. Full-page spinners are forbidden for widget and table data —
 * a skeleton that matches the final layout prevents the content jumping into place, and it
 * communicates *what* is loading rather than just *that* something is.
 *
 * `aria-hidden` because this is purely decorative: the container that owns the data should
 * carry `aria-busy`. Announcing "loading, loading, loading" once per bar is worse than
 * silence.
 */
export function Skeleton({ variant = 'text', width, height, count = 1 }: SkeletonProps) {
  const classes = [styles.skeleton, styles[variant]].join(' ');

  if (count > 1) {
    return (
      <div aria-hidden="true">
        {Array.from({ length: count }, (_, index) => (
          <div
            key={index}
            className={classes}
            style={{ width, height, marginBottom: index < count - 1 ? '0.5em' : undefined }}
          />
        ))}
      </div>
    );
  }

  return <div className={classes} style={{ width, height }} aria-hidden="true" />;
}
