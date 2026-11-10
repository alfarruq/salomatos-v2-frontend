/**
 * A branch ("filial") of the owner's organization. On the server it is the
 * `Clinic` tenant itself, so its id is what `X-Clinic-Id` carries.
 */
export interface Branch {
  id: string
  name: string
  phoneNumber: string
  address: string
  isActive: boolean
  staffCount: number
  patientCount: number
}
