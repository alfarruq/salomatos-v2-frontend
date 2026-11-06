import { Loader2, Upload } from 'lucide-react'
import { type DragEvent, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PatientId } from '@/entities/patient'
import { cn } from '@/shared/lib/cn'
import { toast } from '@/shared/ui'
import { useUploadGalleryImage } from '../model/useUploadGalleryImage'

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
  const isUploading = pendingCount > 0

  async function uploadFiles(files: FileList | null) {
    if (files === null) return
    const images = Array.from(files).filter((file) => file.type.startsWith('image/'))
    if (images.length === 0) return

    setPendingCount((count) => count + images.length)
    await Promise.all(
      images.map(async (file) => {
        try {
          await mutateAsync({ patientId, file })
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
    <div>
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
        accept="image/*"
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
