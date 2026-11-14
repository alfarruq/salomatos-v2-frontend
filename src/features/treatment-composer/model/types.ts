/** One procedure being recorded: a service, on a tooth when it is tooth work. */
export interface TreatmentRow {
  rowId: string
  toothNumber: number | null
  treatmentTypeId: string | null
  treatmentTypeName: string
  /** So'm, as typed. Starts at the price list's figure; the server copies it onto the line. */
  unitPrice: string
  /** So'm taken at the chair for this line, as typed; '' is nothing paid yet. */
  paidAmount: string
  /** Work that continues on a later visit; the doctor completes it then. */
  inProgress: boolean
}

export interface ComposerFields {
  doctorId: string
  notes: string
}
