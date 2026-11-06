import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { setTenantScope, type TenantScope } from '@/shared/api/tenantScope'

/**
 * Moves the app to another branch, or to "all branches".
 *
 * `queryClient.clear()` is mandatory (CLAUDE.md §14): keys are scoped already,
 * but dropping everything also stops a half-finished request from the old
 * branch landing on screen. The session is refetched by the route guard and
 * resolves the new scope.
 */
export function useSwitchScope() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return (scope: TenantScope) => {
    setTenantScope(scope)
    queryClient.clear()
    void navigate({ to: '/dashboard' })
  }
}
