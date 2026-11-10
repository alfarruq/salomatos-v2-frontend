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

export interface CreateBranchInput {
  form: BranchFormInput
  /** A branch to copy the price list and specialties from; null opens it empty. */
  copyCatalogFrom: string | null
}

async function createBranch({ form, copyCatalogFrom }: CreateBranchInput): Promise<Branch> {
  const raw = await httpClient<unknown>('v1/branches/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...toBranchPayload(form), copy_catalog_from: copyCatalogFrom }),
  })
  return toBranch(v.parse(branchSchema, raw))
}

/** ⛔ No optimistic update (§6.5): the server assigns the id and checks the name. */
export function useCreateBranch(clinicId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createBranch,
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: branchKeys.scope(clinicId) })
      // The owner's memberships now include the branch; the switcher reads them from /me/.
      void queryClient.invalidateQueries({ queryKey: sessionKeys.root() })
    },
  })
}
