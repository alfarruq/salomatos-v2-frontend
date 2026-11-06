/** Integer, not a UUID — ADR-013. */
export type DoctorTypeId = string

/**
 * A category of doctor the clinic can hire — "Stomatolog", "Ortodont" and so
 * on. Independent of `Doctor` on the wire: `User.doctor_type` is a foreign key
 * on the model, but neither `DoctorListSerializer` nor
 * `DoctorCreateUpdateSerializer` exposes it, so a type cannot yet be assigned
 * to a doctor through the API — only listed, created, edited and deleted on
 * its own.
 */
export interface DoctorType {
  id: DoctorTypeId
  name: string
}
