export const PAYMENT_METHODS = ['cash', 'card', 'transfer'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export interface Payment {
  id: string
  patientId: string
  patientName: string | null
  amount: number
  method: PaymentMethod
  paidAt: string
  receivedByName: string | null
  notes: string | null
  status: 'received' | 'voided'
  voidReason: string | null
}

/** What a patient owes, derived on the server from procedures and payments. */
export interface PatientBalance {
  patientId: string
  clinicName: string | null
  fullName: string
  phoneNumber: string | null
  charged: number
  paid: number
  debt: number
}

export interface DebtorFilters {
  page: number
}
