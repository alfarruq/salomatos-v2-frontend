/** Integer, not a UUID — ADR-013. */
export type TreatmentTypeId = string

/**
 * A service the clinic offers, with its price.
 *
 * Called `TreatmentType` on the server and shown as "services" in the
 * interface — the domain name is kept here because `Treatment.treatment_type`
 * points at it, and renaming it in the client would mean translating back at
 * every call site.
 */
export interface TreatmentType {
  id: TreatmentTypeId
  /** Optional short code from the clinic's own price list. */
  code: string | null
  name: string
  /** So'm. The server stores a decimal; whole so'm are all a clinic charges. */
  price: number
  /** A specialty id (`entities/doctor-type`). */
  doctorTypeId: string | null
  durationMinutes: number
  isActive: boolean
}

/**
 * What a doctor can be booked or billed for: their specialty's services plus
 * the ones filed under none. A doctor with no specialty sees everything.
 */
export function servicesForSpecialty(
  services: readonly TreatmentType[],
  specialtyId: string | null,
): TreatmentType[] {
  return services.filter(
    (service) =>
      service.isActive &&
      (specialtyId === null ||
        service.doctorTypeId === null ||
        service.doctorTypeId === specialtyId),
  )
}
