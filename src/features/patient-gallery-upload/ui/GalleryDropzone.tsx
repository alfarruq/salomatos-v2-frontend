import { Loader2, Upload } from 'lucide-react'
import { type DragEvent, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ATTACHMENT_KINDS, type AttachmentKind } from '@/entities/attachment'
import type { PatientId } from '@/entities/patient'
import { cn } from '@/shared/lib/cn'
import { Select, TEETH, toast } from '@/shared/ui'
import { useUploadGalleryImage } from '../model/useUploadGalleryImage'

/** What the backend stores (`imaging.CONTENT_TYPES`); anything else would be served as a blob of bytes. */
const ACCEPTED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'pdf', 'dcm'] as const
const ACCEPT = ACCEPTED_EXTENSIONS.map((extension) => `.${extension}`).join(',')

function isAccepted(file: File): boolean {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  return (ACCEPTED_EXTENSIONS as readonly string[]).includes(extension)
}

/** Radix Select needs a real value for "no tooth". */
const NO_TOOTH = 'none'

export interface GalleryDropzoneProps {
  clinicId: string
  patientId: PatientId
}

/**
 * Drag-and-drop (and click-to-browse) upload for a patient's gallery.
 *
 * Each file is its own `POST` — the backend takes one image per request, so
 * dropping several fires them in parallel rather than batching. One failure
 * does not block the rest; it gets its own toast and the others still land.
 */
export function GalleryDropzone({ clinicId, patientId }: GalleryDropzoneProps) {
  const { t } = useTranslation(['patients', 'common'])
  const { mutateAsync } = useUploadGalleryImage(clinicId)
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDraggingOver, setDraggingOver] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [kind, setKind] = useState<AttachmentKind>('xray')
  const [tooth, setTooth] = useState<string>(NO_TOOTH)
  const isUploading = pendingCount > 0

  async function uploadFiles(files: FileList | null) {
    if (files === null) return
    const all = Array.from(files)
    const images = all.filter(isAccepted)
    if (images.length < all.length) toast.error(t('patients:detail.galleryUnsupported'))
    if (images.length === 0) return

    setPendingCount((count) => count + images.length)
    await Promise.all(
      images.map(async (file) => {
        try {
          await mutateAsync({
            patientId,
            file,
            kind,
            tooth: tooth === NO_TOOTH ? null : Number(tooth),
          })
        } catch {
          toast.error(t('patients:detail.galleryUploadFailed'))
        } finally {
          setPendingCount((count) => count - 1)
        }
      }),
    )
  }

  function handleDragOver(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault()
    setDraggingOver(true)
  }

  function handleDragLeave(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault()
    setDraggingOver(false)
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault()
    setDraggingOver(false)
    void uploadFiles(event.dataTransfer.files)
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Chosen before the drop: every file in this batch is filed under them. */}
      <div className="flex flex-wrap gap-2">
        <Select
          aria-label={t('patients:detail.galleryKind')}
          className="w-auto min-w-40"
          onValueChange={(value) => setKind(value as AttachmentKind)}
          options={ATTACHMENT_KINDS.map((value) => ({
            value,
            label: t(`patients:attachmentKind.${value}`),
          }))}
          size="sm"
          value={kind}
        />
        <Select
          aria-label={t('patients:detail.galleryTooth')}
          className="w-auto min-w-32"
          onValueChange={setTooth}
          options={[
            { value: NO_TOOTH, label: t('patients:detail.galleryNoTooth') },
            ...TEETH.map((meta) => ({
              value: String(meta.fdi),
              label: t('patients:detail.galleryToothNumber', { tooth: meta.fdi }),
            })),
          ]}
          size="sm"
          value={tooth}
        />
      </div>
      <button
        aria-busy={isUploading || undefined}
        className={cn(
          'flex w-full flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed px-6 py-10 text-center',
          'transition-colors duration-150 ease-out-apple',
          isDraggingOver
            ? 'border-accent bg-accent-soft/40'
            : 'border-border hover:border-border-strong',
        )}
        onClick={() => inputRef.current?.click()}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        type="button"
      >
        {isUploading ? (
          <Loader2 aria-hidden="true" className="size-8 animate-spin text-text-tertiary" />
        ) : (
          <Upload aria-hidden="true" className="size-8 text-text-tertiary" />
        )}
        <p className="text-body font-medium text-text">
          {isUploading
            ? t('patients:detail.galleryUploading')
            : t('patients:detail.galleryDropHere')}
        </p>
        {isUploading ? null : (
          <p className="text-footnote text-text-secondary">
            {t('patients:detail.galleryOrBrowse')}
          </p>
        )}
      </button>

      <input
        accept={ACCEPT}
        aria-hidden="true"
        className="sr-only"
        multiple
        onChange={(event) => {
          void uploadFiles(event.target.files)
          event.target.value = ''
        }}
        ref={inputRef}
        tabIndex={-1}
        type="file"
      />
    </div>
  )
}
