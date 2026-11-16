import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as v from 'valibot'
import { type Clinic, clinicKeys, clinicSchema, toClinic } from '@/entities/clinic'
import { type Doctor, type DoctorId, doctorKeys, doctorSchema, toDoctor } from '@/entities/doctor'
import { httpClient } from '@/shared/api/httpClient'

async function setDoctorMoney({
  doctorId,
  canSeeMoney,
}: {
  doctorId: DoctorId
  canSeeMoney: boolean
}): Promise<Doctor> {
  const raw = await httpClient<unknown>(`v1/staff/${doctorId}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ can_see_money: canSeeMoney }),
  })
  return toDoctor(v.parse(doctorSchema, raw))
}

/** The branch is the one in `X-Clinic-Id`; the body never names it. */
async function setClinicMoney(doctorsSeeMoney: boolean): Promise<Clinic> {
  const raw = await httpClient<unknown>('v1/clinic/', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ doctors_see_money: doctorsSeeMoney }),
  })
  return toClinic(v.parse(clinicSchema, raw))
}

/** ⛔ No optimistic update: the switch must show what the server actually enforces. */
export function useSetDoctorMoney(clinicId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: setDoctorMoney,
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: doctorKeys.scope(clinicId) })
    },
  })
}

export function useSetClinicMoney(clinicId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: setClinicMoney,
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: clinicKeys.scope(clinicId) })
    },
  })
}
