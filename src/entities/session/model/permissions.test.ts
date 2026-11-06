import { describe, expect, it } from 'vitest'
import { readOnly } from './permissions'
import type { Permission } from './types'

describe('readOnly', () => {
  it('keeps what an all-branches view can do and drops every write', () => {
    const all = new Set<Permission>([
      'patient:view',
      'patient:view_all',
      'patient:manage',
      'payment:view',
      'payment:manage',
      'report:view',
    ])

    expect([...readOnly(all)].sort()).toEqual([
      'patient:view',
      'patient:view_all',
      'payment:view',
      'report:view',
    ])
  })
})
