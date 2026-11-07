import * as v from 'valibot'
import type { VoiceDraft, VoiceStatus } from './types'

/**
 * The wire contract of `apps/voice` on the backend:
 *
 *   GET  /api/v1/voice/status/   whether the feature is on, and this month's use
 *   POST /api/v1/voice/draft/    {form, text, patient?} -> a draft; saves nothing
 */
const patientRefSchema = v.object({ id: v.string(), full_name: v.string() })

export const voiceDraftSchema = v.object({
  form: v.picklist(['patient', 'procedure', 'prescription']),
  patient: v.nullable(patientRefSchema),
  patient_name: v.string(),
  patient_candidates: v.array(patientRefSchema),
  patient_fields: v.nullable(
    v.object({
      full_name: v.string(),
      phone_number: v.string(),
      birth_date: v.nullable(v.string()),
      gender: v.picklist(['', 'male', 'female']),
      address: v.string(),
    }),
  ),
  procedures: v.array(
    v.object({
      service: v.nullable(v.string()),
      service_name: v.string(),
      heard: v.string(),
      tooth: v.nullable(v.number()),
    }),
  ),
  medicines: v.array(
    v.object({
      medicine: v.string(),
      dose: v.string(),
      form: v.string(),
      times_per_day: v.nullable(v.number()),
      duration_days: v.nullable(v.number()),
      meal_relation: v.picklist(['before', 'after', 'with', 'any']),
      instructions: v.string(),
    }),
  ),
  notes: v.string(),
})

export const voiceStatusSchema = v.object({
  enabled: v.boolean(),
  used_this_month: v.number(),
  monthly_limit: v.number(),
})

export function toVoiceDraft(raw: v.InferOutput<typeof voiceDraftSchema>): VoiceDraft {
  const toRef = (patient: { id: string; full_name: string }) => ({
    id: patient.id,
    fullName: patient.full_name,
  })
  return {
    form: raw.form,
    patient: raw.patient === null ? null : toRef(raw.patient),
    patientName: raw.patient_name,
    patientCandidates: raw.patient_candidates.map(toRef),
    patientFields:
      raw.patient_fields === null
        ? null
        : {
            fullName: raw.patient_fields.full_name,
            phoneNumber: raw.patient_fields.phone_number,
            birthDate: raw.patient_fields.birth_date,
            gender: raw.patient_fields.gender,
            address: raw.patient_fields.address,
          },
    procedures: raw.procedures.map((item) => ({
      serviceId: item.service,
      serviceName: item.service_name,
      heard: item.heard,
      tooth: item.tooth,
    })),
    medicines: raw.medicines.map((item) => ({
      medicine: item.medicine,
      dose: item.dose,
      form: item.form,
      timesPerDay: item.times_per_day,
      durationDays: item.duration_days,
      mealRelation: item.meal_relation,
      instructions: item.instructions,
    })),
    notes: raw.notes,
  }
}

export function toVoiceStatus(raw: v.InferOutput<typeof voiceStatusSchema>): VoiceStatus {
  return {
    isEnabled: raw.enabled,
    usedThisMonth: raw.used_this_month,
    monthlyLimit: raw.monthly_limit,
  }
}
