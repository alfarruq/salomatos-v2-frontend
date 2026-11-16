/** Integer, not a UUID — ADR-013. */
export type AdministratorId = string

/**
 * A clinic admin (receptionist) account: a `User` row with `role='admin'`
 * whose `clinic` foreign key points at the clinic account. The server sets
 * both itself on create, the same as for doctors.
 */
export interface Administrator {
  id: AdministratorId
  fullName: string
  username: string | null
  phoneNumber: string | null
  email: string | null
  isActive: boolean
  /** Switch 1: off hides every money figure, debts included. */
  canSeeMoney: boolean
  /** Switch 2: with money on, show only what each patient owes. */
  debtsOnly: boolean
}
