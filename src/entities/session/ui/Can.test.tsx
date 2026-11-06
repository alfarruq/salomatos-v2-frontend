import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useSessionStore } from '../model/store'
import type { Session } from '../model/types'
import { Can } from './Can'

function signIn(permissions: Session['permissions']) {
  useSessionStore.getState().setSession({
    userId: 'user-1',
    username: 'admin',
    clinicId: 'clinic:test',
    fullName: 'Dilnoza Rahimova',
    phoneNumber: '+998901112233',
    email: 'a@example.test',
    memberships: [],
    organizations: [],
    scope: { kind: 'clinic', id: 'test' },
    scopeName: 'Test',
    isAllBranches: false,
    membershipId: 'membership-1',
    role: 'admin',
    // Set explicitly rather than derived from the role: these tests are about
    // what <Can> does with a permission set, not about where it came from.
    permissions,
  })
}

describe('Can', () => {
  afterEach(() => useSessionStore.getState().clear())

  it('shows a control the user is allowed to use', () => {
    signIn(new Set(['patient:archive']))

    render(
      <Can permission="patient:archive">
        <button type="button">Arxivlash</button>
      </Can>,
    )

    expect(screen.getByRole('button', { name: 'Arxivlash' })).toBeInTheDocument()
  })

  it('hides one they are not', () => {
    signIn(new Set(['patient:view']))

    render(
      <Can permission="patient:archive">
        <button type="button">Arxivlash</button>
      </Can>,
    )

    expect(screen.queryByRole('button', { name: 'Arxivlash' })).not.toBeInTheDocument()
  })

  it('hides everything when nobody is signed in', () => {
    render(
      <Can permission="patient:view">
        <button type="button">Bemorlar</button>
      </Can>,
    )

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders a fallback when one is given', () => {
    signIn(new Set([]))

    render(
      <Can fallback={<p>Ruxsat yo&apos;q</p>} permission="payment:view">
        <button type="button">Hisob</button>
      </Can>,
    )

    expect(screen.getByText("Ruxsat yo'q")).toBeInTheDocument()
  })
})
