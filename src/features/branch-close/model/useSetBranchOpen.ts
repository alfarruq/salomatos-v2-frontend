import { useMutation, useQueryClient } from '@tanstack/react-query'
import { branchKeys } from '@/entities/branch'
import { sessionKeys } from '@/entities/session'
import { httpClient } from '@/shared/api/httpClient'

/** Closing deactivates the branch (its records stay); reopening undoes that. */
async function setBranchOpen({ branchId, open }: { branchId: string; open: boolean }) {
  if (open) {
    await httpClient<unknown>(`v1/branches/${branchId}/reactivate/`, { method: 'POST' })
  } else {
    await httpClient<void>(`v1/branches/${branchId}/`, { method: 'DELETE' })
  }
}

/** ⛔ No optimistic update (§6.5): the server refuses to close the last open branch. */
export function useSetBranchOpen(clinicId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: setBranchOpen,
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: branchKeys.scope(clinicId) })
      // A closed branch drops out of the switcher.
      void queryClient.invalidateQueries({ queryKey: sessionKeys.root() })
    },
  })
}
