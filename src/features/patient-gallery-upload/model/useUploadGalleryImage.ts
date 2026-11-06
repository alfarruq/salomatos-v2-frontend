import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as v from 'valibot'
import {
  type Attachment,
  type AttachmentKind,
  attachmentKeys,
  attachmentSchema,
  toAttachment,
} from '@/entities/attachment'
import type { PatientId } from '@/entities/patient'
import { httpClient } from '@/shared/api/httpClient'

export interface UploadGalleryImageInput {
  patientId: PatientId
  file: File
  kind?: AttachmentKind
}

/** Multipart, unlike every other write: `attachments/` takes the file itself. */
async function uploadGalleryImage({
  patientId,
  file,
  kind = 'photo',
}: UploadGalleryImageInput): Promise<Attachment> {
  const body = new FormData()
  body.append('patient', patientId)
  body.append('kind', kind)
  body.append('file', file)

  const raw = await httpClient<unknown>('v1/attachments/', { method: 'POST', body })
  return toAttachment(v.parse(attachmentSchema, raw))
}

export function useUploadGalleryImage(clinicId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: uploadGalleryImage,
    retry: false,
    onSuccess: (_attachment, { patientId }) => {
      void queryClient.invalidateQueries({ queryKey: attachmentKeys.list(clinicId, patientId) })
    },
  })
}
