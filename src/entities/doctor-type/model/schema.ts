import * as v from 'valibot'
import type { DoctorType } from './types'

/**
 * The wire contract for `/clinic/doctors/types/` (ADR-006).
 *
 * A plain array, like doctors and treatment types — the published schema
 * shows a single object because `swagger_auto_schema` was given the
 * serializer without `many=True`; `get_doctor_types` returns a list.
 */
export const doctorTypeSchema = v.object({
  // A type without a name is not renderable; nothing else is on this row.
  id: v.pipe(v.string(), v.uuid()),
  name: v.string(),
})

export type DoctorTypeResponse = v.InferOutput<typeof doctorTypeSchema>

export function toDoctorType(response: DoctorTypeResponse): DoctorType {
  return { id: response.id, name: response.name }
}
