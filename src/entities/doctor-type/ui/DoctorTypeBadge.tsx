import { type AvatarTone, Badge } from '@/shared/ui'

// Spelled out in full so Tailwind's scanner sees every class; reuses the contrast-checked avatar pairs.
const toneClass: Record<AvatarTone, string> = {
  1: 'bg-avatar-1 text-avatar-1-ink',
  2: 'bg-avatar-2 text-avatar-2-ink',
  3: 'bg-avatar-3 text-avatar-3-ink',
  4: 'bg-avatar-4 text-avatar-4-ink',
  5: 'bg-avatar-5 text-avatar-5-ink',
  6: 'bg-avatar-6 text-avatar-6-ink',
}

export interface DoctorTypeBadgeProps {
  name: string
  /** From `doctorTypeToneOf`; neutral when absent. */
  tone: AvatarTone | undefined
}

export function DoctorTypeBadge({ name, tone }: DoctorTypeBadgeProps) {
  return <Badge {...(tone === undefined ? {} : { className: toneClass[tone] })}>{name}</Badge>
}
