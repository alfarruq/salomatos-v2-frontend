import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as v from 'valibot'
import {
  type Branch,
  type BranchFormInput,
  branchKeys,
  branchSchema,
  toBranch,
  toBranchPayload,
} from '@/entities/branch'
import { sessionKeys } from '@/entities/session'
import { httpClient } from '@/shared/api/httpClient'

async function updateBranch({
  branchId,
  input,
}: {
  branchId: string
  input: BranchFormInput
}): Promise<Branch> {
  const raw = await httpClient<unknown>(`v1/branches/${branchId}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toBranchPayload(input)),
  })
  return toBranch(v.parse(branchSchema, raw))
}

/** ⛔ No optimistic update (§6.5): a rejected rename would leave the wrong name on screen. */
export function useUpdateBranch(clinicId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateBranch,
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: branchKeys.scope(clinicId) })
      // The switcher shows branch names from /me/.
      void queryClient.invalidateQueries({ queryKey: sessionKeys.root() })
    },
  })
}
