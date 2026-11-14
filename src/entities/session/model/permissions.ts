import type { Permission } from './types'

/**
 * The server answers writes in "all branches" mode with 400 (a new row needs
 * one branch), so the UI keeps only the read permissions there and every
 * create/edit control disappears on its own. `patient:bot_access` is a read
 * (the reset is gated by `patient:manage` in the UI).
 */
const READ_ONLY = /:(view|view_all)$/

export function readOnly(permissions: ReadonlySet<Permission>): ReadonlySet<Permission> {
  return new Set(
    [...permissions].filter(
      (p) =>
        READ_ONLY.test(p) ||
        p === 'report:view' ||
        p === 'audit:view' ||
        p === 'patient:bot_access',
    ),
  )
}
