import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, FileText } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatDate } from '@/shared/lib/datetime'
import { Dialog, EmptyState, Skeleton, toast } from '@/shared/ui'
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
  const title = [
    t(`attachmentKind.${attachment.kind}`),
    attachment.toothNumber === null
      ? null
      : t('detail.galleryToothNumber', { tooth: attachment.toothNumber }),
    formatDate(attachment.createdAt, { locale: i18n.language }),
  ]
    .filter((part): part is string => part !== null)
    .join(' · ')

  if (!image) return <FileTile attachment={attachment} clinicId={clinicId} title={title} />

  if (url === null) return <Skeleton className="aspect-square w-full rounded-card" />

  return (
    <div className="flex flex-col gap-1">
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
      {/* The kind and tooth are what a doctor scans the gallery for. */}
      <span aria-hidden="true" className="truncate text-caption text-text-secondary">
        {title}
      </span>
    </div>
  )
}

/** File extensions by stored type, for the download name (ids only: no PHI in file names). */
const EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/dicom': 'dcm',
}

/**
 * A PDF or DICOM file cannot be previewed here, so the tile downloads it. The
 * bytes still come through the authenticated endpoint, never a public link.
 */
function FileTile({
  clinicId,
  attachment,
  title,
}: {
  clinicId: string
  attachment: Attachment
  title: string
}) {
  const { t } = useTranslation('patients')
  const queryClient = useQueryClient()
  const [isLoading, setLoading] = useState(false)

  async function download() {
    setLoading(true)
    try {
      const blob = await queryClient.fetchQuery(attachmentQueries.file(clinicId, attachment.id))
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${attachment.kind}-${attachment.id}.${EXTENSIONS[attachment.contentType] ?? 'bin'}`
      link.click()
      // Revoked on the next tick: the click has already handed the URL to the download.
      setTimeout(() => URL.revokeObjectURL(url), 0)
    } catch {
      toast.error(t('detail.galleryDownloadFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      aria-busy={isLoading || undefined}
      aria-label={`${t('detail.galleryOpen')} — ${title}`}
      className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-card border border-border p-3 text-center transition-colors duration-150 ease-out-apple hover:bg-sunken"
      disabled={isLoading}
      onClick={() => void download()}
      type="button"
    >
      <FileText aria-hidden="true" className="size-6 text-text-secondary" />
      <span className="text-caption text-text-secondary">{title}</span>
      <span className="flex items-center gap-1 text-caption font-medium text-accent-text">
        <Download aria-hidden="true" className="size-4" />
        {t('detail.galleryOpen')}
      </span>
    </button>
  )
}
