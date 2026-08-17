// Public surface of the shared UI layer. Consumers import from '@/shared/ui', not from
// individual files — so a component can be restructured internally without touching call
// sites, and the barrel makes "what atoms exist" answerable by reading one file.
export { Button } from './Button/Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button/Button';

export { Skeleton } from './Skeleton/Skeleton';
export type { SkeletonProps, SkeletonVariant } from './Skeleton/Skeleton';

export { Badge } from './Badge/Badge';
export type { BadgeProps, BadgeTone } from './Badge/Badge';
