import styles from './Skeleton.module.scss';

export type SkeletonVariant = 'text' | 'block' | 'circle';

export interface SkeletonProps {
  variant?: SkeletonVariant;
  width?: string;
  height?: string;
  count?: number;
}

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
