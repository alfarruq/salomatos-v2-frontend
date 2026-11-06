import * as v from 'valibot'
import { pageSchema } from '@/shared/api/pagination'
import { ATTACHMENT_KINDS, type Attachment } from './types'

/** `AttachmentSerializer`, validated at runtime (ADR-006). The file itself is never in it. */
export const attachmentSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  patient: v.string(),
  kind: v.fallback(v.picklist(ATTACHMENT_KINDS), 'document'),
  tooth: v.optional(v.nullable(v.number()), null),
  content_type: v.optional(v.string(), ''),
  size_bytes: v.optional(v.number(), 0),
  created_at: v.string(),
})

export const attachmentPageSchema = pageSchema(attachmentSchema)

export function toAttachment(response: v.InferOutput<typeof attachmentSchema>): Attachment {
  return {
    id: response.id,
    patientId: response.patient,
    kind: response.kind,
    toothNumber: response.tooth,
    contentType: response.content_type,
    sizeBytes: response.size_bytes,
    createdAt: response.created_at,
  }
}

export function isImage(attachment: Attachment): boolean {
  return attachment.contentType.startsWith('image/')
}
