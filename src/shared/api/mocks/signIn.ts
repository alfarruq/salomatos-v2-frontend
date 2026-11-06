import { setTenantScope } from '../tenantScope'
import { clearAccessToken, setAccessToken } from '../tokenStore'
import { accessTokenFor, MOCK_CLINICS, MOCK_ORGANIZATION, type MockUserKey } from './fixtures'

/**
 * Test helper: what a real sign-in leaves behind for the request layer — a
 * token and a chosen branch. Without the branch every tenant endpoint answers
 * 400, exactly as the server does.
 */
export function signInAs(
  user: MockUserKey,
  branch: keyof typeof MOCK_CLINICS | 'all' = 'main',
): void {
  setAccessToken(accessTokenFor(user))
  setTenantScope(
    branch === 'all'
      ? { kind: 'organization', id: MOCK_ORGANIZATION.id }
      : { kind: 'clinic', id: MOCK_CLINICS[branch].id },
  )
}

export function signOut(): void {
  clearAccessToken()
  setTenantScope(null)
}
