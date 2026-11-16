import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as v from 'valibot'
import {
  type Administrator,
  type AdministratorId,
  administratorKeys,
  administratorSchema,
  toAdministrator,
} from '@/entities/administrator'
import { type Clinic, clinicKeys, clinicSchema, toClinic } from '@/entities/clinic'
import { httpClient } from '@/shared/api/httpClient'

interface AdminMoneyChange {
  administratorId: AdministratorId
  canSeeMoney?: boolean
  debtsOnly?: boolean
}

async function setAdminMoney({
  administratorId,
  canSeeMoney,
  debtsOnly,
}: AdminMoneyChange): Promise<Administrator> {
  const body: Record<string, boolean> = {}
  if (canSeeMoney !== undefined) body.can_see_money = canSeeMoney
  if (debtsOnly !== undefined) body.debts_only = debtsOnly
  const raw = await httpClient<unknown>(`v1/staff/${administratorId}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return toAdministrator(v.parse(administratorSchema, raw))
}

/** The branch is the one in `X-Clinic-Id`; the body never names it. */
async function setClinicAdminsMoney(adminsSeeMoney: boolean): Promise<Clinic> {
  const raw = await httpClient<unknown>('v1/clinic/', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ admins_see_money: adminsSeeMoney }),
  })
  return toClinic(v.parse(clinicSchema, raw))
}

/** No optimistic update: the switch must show what the server actually enforces. */
export function useSetAdminMoney(clinicId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: setAdminMoney,
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: administratorKeys.scope(clinicId) })
    },
  })
}

export function useSetClinicAdminsMoney(clinicId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: setClinicAdminsMoney,
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: clinicKeys.scope(clinicId) })
    },
  })
}
