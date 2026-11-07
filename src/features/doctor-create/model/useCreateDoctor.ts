import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as v from 'valibot'
import {
  type Doctor,
  type DoctorFormInput,
  doctorKeys,
  doctorSchema,
  toDoctor,
  toDoctorPayload,
} from '@/entities/doctor'
import type { PayTermsPayload } from '@/entities/expense'
import { httpClient } from '@/shared/api/httpClient'

export interface CreateDoctorInput {
  doctor: DoctorFormInput
  /** Agreed pay from this month on; `null` leaves it for later (owner only on the server). */
  compensation: PayTermsPayload | null
}

async function createDoctor({ doctor, compensation }: CreateDoctorInput): Promise<Doctor> {
  const body =
    compensation === null ? toDoctorPayload(doctor) : { ...toDoctorPayload(doctor), compensation }
  const raw = await httpClient<unknown>('v1/staff/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  // The server assigns `role` and `clinic` itself and answers with the list
  // serializer, so the new row is usable without a refetch.
  return toDoctor(v.parse(doctorSchema, raw))
}

/**
 * ⛔ No optimistic update. §6.5 allows them only for reversible actions, and
 * the server both assigns the id and enforces `unique_phone_per_clinic` — a
 * doctor can appear in the list and then be refused.
 */
export function useCreateDoctor(clinicId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createDoctor,
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: doctorKeys.scope(clinicId) })
    },
  })
}
