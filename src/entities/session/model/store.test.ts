import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useActsOnlyAs, useSessionStore } from './store'
import type { Permission, Session } from './types'

function signIn(role: Session['role'], permissions: Permission[]) {
  const session: Session = {
    userId: 'user:1',
    username: 'someone',
    fullName: 'Someone',
    phoneNumber: null,
    email: null,
    memberships: [],
    organizations: [],
    scope: { kind: 'clinic', id: 'clinic:1' },
    clinicId: 'clinic:clinic:1',
    scopeName: 'Branch',
    isAllBranches: false,
    role,
    membershipId: 'member:1',
    permissions: new Set(permissions),
  }
  useSessionStore.getState().setSession(session)
}

afterEach(() => useSessionStore.getState().clear())

describe('useActsOnlyAs', () => {
  it('pins a doctor to themselves', () => {
    signIn('doctor', ['appointment:manage'])
    const { result } = renderHook(() => useActsOnlyAs('appointment:view_all'))
    expect(result.current).toBe('member:1')
  })

  it('leaves the front desk free to pick any doctor', () => {
    signIn('admin', ['appointment:manage', 'appointment:view_all'])
    const { result } = renderHook(() => useActsOnlyAs('appointment:view_all'))
    expect(result.current).toBeNull()
  })
})
