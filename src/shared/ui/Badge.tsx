import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '@/shared/lib/cn'

export type BadgeTone = 'neutral' | 'accent' | 'violet' | 'success' | 'warning' | 'danger'

export interface BadgeProps extends Omit<ComponentPropsWithoutRef<'span'>, 'className'> {
  tone?: BadgeTone
  className?: string
}

/**
 * Soft background with the matching text colour — both halves are contrast
 * checked, so a badge stays readable without a border.
 */
const tones: Record<BadgeTone, string> = {
  neutral: 'bg-sunken text-text-secondary',
  accent: 'bg-accent-soft text-accent-text',
  // A second hue for categories that sit next to `accent` and must read as different.
  violet: 'bg-avatar-3 text-avatar-3-ink',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
}

export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5',
        'text-caption font-medium whitespace-nowrap',
        tones[tone],
        className,
      )}
      {...props}
    />
  )
}
