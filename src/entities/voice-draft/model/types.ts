/** The forms a dictation can fill. Mirrors `apps/voice/drafts.py` `FORMS`. */
export type VoiceForm = 'patient' | 'procedure' | 'prescription'

export interface VoicePatientRef {
  id: string
  fullName: string
}

export interface VoicePatientFields {
  fullName: string
  /** `+998…` or '' — the server drops anything that is not a valid number. */
  phoneNumber: string
  /** `yyyy-MM-dd` or null. */
  birthDate: string | null
  workplace: string
  address: string
}

export interface VoiceProcedure {
  /** A service of this clinic's price list, or null when nothing matched. */
  serviceId: string | null
  serviceName: string
  /** The treatment as dictated, shown when no service matched. */
  heard: string
  tooth: number | null
}

export interface VoiceMedicine {
  medicine: string
  dose: string
  form: string
  timesPerDay: number | null
  durationDays: number | null
  mealRelation: 'before' | 'after' | 'with' | 'any'
  instructions: string
}

/** A suggestion only: nothing is saved until the doctor submits the form. */
export interface VoiceDraft {
  form: VoiceForm
  patient: VoicePatientRef | null
  patientName: string
  patientCandidates: VoicePatientRef[]
  patientFields: VoicePatientFields | null
  procedures: VoiceProcedure[]
  medicines: VoiceMedicine[]
  notes: string
}

export interface VoiceStatus {
  isEnabled: boolean
  usedThisMonth: number
  monthlyLimit: number
}

export interface VoiceDraftRequest {
  form: VoiceForm
  text: string
  /** Sent when the form already has its patient, so the name is not re-matched. */
  patientId?: string | null
}
