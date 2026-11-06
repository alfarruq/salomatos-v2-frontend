/** One procedure being recorded: a service, on a tooth when it is tooth work. */
export interface TreatmentRow {
  rowId: string
  toothNumber: number | null
  treatmentTypeId: string | null
  treatmentTypeName: string
  /** So'm, as typed. Starts at the price list's figure; the server copies it onto the line. */
  unitPrice: string
  /** Whole percent, as typed. */
  discountPercent: string
}

export interface ComposerFields {
  doctorId: string
  notes: string
}
