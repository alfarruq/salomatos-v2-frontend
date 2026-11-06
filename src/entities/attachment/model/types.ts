/** `Attachment.Kind` on the backend. */
export const ATTACHMENT_KINDS = ['xray', 'panorama', 'cbct', 'photo', 'document'] as const
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number]

/** An X-ray, photo or document on a patient's card (`AttachmentSerializer`). */
export interface Attachment {
  id: string
  patientId: string
  kind: AttachmentKind
  /** FDI tooth number, when the image is of one tooth. */
  toothNumber: number | null
  contentType: string
  sizeBytes: number
  /** UTC ISO-8601 instant. */
  createdAt: string
}
