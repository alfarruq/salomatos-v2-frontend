import { useQuery } from '@tanstack/react-query'
import { FileText } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatDate } from '@/shared/lib/datetime'
import { Dialog, EmptyState, Skeleton } from '@/shared/ui'
import { attachmentQueries } from '../api/queries'
import { isImage } from '../model/schema'
import type { Attachment } from '../model/types'
import { useObjectUrl } from './useObjectUrl'

export interface AttachmentGalleryProps {
  clinicId: string
  attachments: readonly Attachment[]
}

/**
 * Thumbnails of a patient's X-rays and photos. Files are private: each one is
 * fetched with the session's token and shown from an in-memory object URL,
 * never from a link that would work without signing in.
 */
export function AttachmentGallery({ clinicId, attachments }: AttachmentGalleryProps) {
  const { t } = useTranslation('patients')

  if (attachments.length === 0) {
    return (
      <EmptyState
        description={t('detail.galleryEmptyDescription')}
        title={t('detail.galleryEmpty')}
      />
    )
  }

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {attachments.map((attachment) => (
        <li key={attachment.id}>
          <AttachmentTile attachment={attachment} clinicId={clinicId} />
        </li>
      ))}
    </ul>
  )
}

function AttachmentTile({ clinicId, attachment }: { clinicId: string; attachment: Attachment }) {
  const { t, i18n } = useTranslation('patients')
  const image = isImage(attachment)
  const file = useQuery({ ...attachmentQueries.file(clinicId, attachment.id), enabled: image })
  const url = useObjectUrl(file.data)
  const title = `${t(`attachmentKind.${attachment.kind}`)} · ${formatDate(attachment.createdAt, { locale: i18n.language })}`

  if (!image) {
    return (
      <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-card border border-border p-3 text-center">
        <FileText aria-hidden="true" className="size-6 text-text-secondary" />
        <span className="text-caption text-text-secondary">{title}</span>
      </div>
    )
  }

  if (url === null) return <Skeleton className="aspect-square w-full rounded-card" />

  return (
    <Dialog
      title={title}
      trigger={
        <button
          aria-label={title}
          className="block aspect-square w-full overflow-hidden rounded-card border border-border transition-opacity duration-150 ease-out-apple hover:opacity-90"
          type="button"
        >
          <img alt="" className="size-full object-cover" src={url} />
        </button>
      }
    >
      <img alt="" className="max-h-[70vh] w-full rounded-control object-contain" src={url} />
    </Dialog>
  )
}
