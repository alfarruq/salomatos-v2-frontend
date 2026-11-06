import { useMutation, useQueryClient } from '@tanstack/react-query'
import { type DoctorTypeId, doctorTypeKeys } from '@/entities/doctor-type'
import { httpClient } from '@/shared/api/httpClient'

/**
 * Unlike deleting a doctor or a service, this is safe to offer: `User.
 * doctor_type` and `TreatmentType.doctor_type` are both `on_delete=SET_NULL`,
 * so removing a type clears the reference instead of taking anything down
 * with it — no doctor and no service disappears.
 *
 * ⚠️ Same missing tenant check as update — see `useUpdateDoctorType`.
 */
async function deleteDoctorType(doctorTypeId: DoctorTypeId): Promise<void> {
  await httpClient<void>(`v1/specialties/${doctorTypeId}/`, { method: 'DELETE' })
}

/** ⛔ No optimistic update (§6.5): a refused delete should not vanish the row first. */
export function useDeleteDoctorType(clinicId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteDoctorType,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: doctorTypeKeys.scope(clinicId) })
    },
  })
}
