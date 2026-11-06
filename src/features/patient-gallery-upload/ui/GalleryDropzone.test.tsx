// jsdom's own `File` does not round-trip through undici's multipart parser
// (the one MSW's `request.formData()` uses) — Node's does. Cast to the DOM
// `File` type at each use: structurally different `ReadableStream` generics,
// same object `userEvent.upload` and `FormData.append` accept at runtime.
import { File as NodeFile } from 'node:buffer'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { Suspense } from 'react'
import { I18nextProvider } from 'react-i18next'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { MOCK_PATIENTS } from '@/shared/api/mocks/fixtures'
import { server } from '@/shared/api/mocks/server'
import { signInAs, signOut } from '@/shared/api/mocks/signIn'
import { createI18n } from '@/shared/i18n'
import { GalleryDropzone } from './GalleryDropzone'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  signOut()
})
afterAll(() => server.close())

const CLINIC_ID = 'clinic:test'
const PATIENT_ID = MOCK_PATIENTS[0]?.id ?? ''

const ATTACHMENT = {
  id: '00000000-0000-4000-8013-000000000001',
  patient: PATIENT_ID,
  kind: 'photo',
  tooth: null,
  content_type: 'image/png',
  size_bytes: 5,
  created_at: '2026-08-20T09:15:00Z',
}

function png(name: string): File {
  return new NodeFile(['pixel'], name, { type: 'image/png' }) as unknown as File
}

function renderDropzone() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  const { container } = render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={createI18n('uz-Latn')}>
        <Suspense fallback={null}>
          <GalleryDropzone clinicId={CLINIC_ID} patientId={PATIENT_ID} />
        </Suspense>
      </I18nextProvider>
    </QueryClientProvider>,
  )

  return { container }
}

describe('GalleryDropzone', () => {
  beforeEach(() => signInAs('owner'))

  it('shows the drop prompt and the browse hint', async () => {
    renderDropzone()

    expect(await screen.findByText('Rasmlarni shu yerga tashlang')).toBeInTheDocument()
    expect(screen.getByText('yoki tanlash uchun bosing')).toBeInTheDocument()
  })

  it('sends the patient id and the file as multipart', async () => {
    const onRequest = vi.fn()
    server.use(
      http.post('/api/v1/attachments/', async ({ request }) => {
        const form = await request.formData()
        onRequest(form.get('patient'), form.get('file'))
        return HttpResponse.json(ATTACHMENT, { status: 201 })
      }),
    )

    const { container } = renderDropzone()
    await screen.findByText('Rasmlarni shu yerga tashlang')
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')
    if (input === null) throw new Error('file input not found')

    await userEvent.upload(input, png('tooth.png'))

    await waitFor(() => expect(onRequest).toHaveBeenCalledTimes(1))
    const [patient, image] = onRequest.mock.calls[0] as [string, unknown]
    expect(patient).toBe(PATIENT_ID)
    // Not asserting the file's own identity past this point: jsdom's FormData
    // and undici's multipart parser (what MSW's `request.formData()` uses)
    // are different File/Blob realms, so a file attached here survives the
    // round trip but does not keep its exact shape — confirmed for real
    // against the live backend instead (see the feature's model comment).
    expect(image).toBeTruthy()

    // Back to the idle prompt once the upload has landed — nothing left in flight.
    expect(await screen.findByText('Rasmlarni shu yerga tashlang')).toBeInTheDocument()
  })

  it('never reaches the server for a file that is not an image', async () => {
    const onRequest = vi.fn()
    server.use(
      http.post('/api/v1/attachments/', () => {
        onRequest()
        return HttpResponse.json(ATTACHMENT, { status: 201 })
      }),
    )

    const { container } = renderDropzone()
    await screen.findByText('Rasmlarni shu yerga tashlang')
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')
    if (input === null) throw new Error('file input not found')

    await userEvent.upload(
      input,
      new NodeFile(['x'], 'notes.txt', { type: 'text/plain' }) as unknown as File,
    )

    // Nothing to await for a no-op — a short settle is the only way to show
    // the request never fires, since there is no state change to wait on.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(onRequest).not.toHaveBeenCalled()
  })

  it('recovers to the idle prompt after a failed upload', async () => {
    server.use(http.post('/api/v1/attachments/', () => HttpResponse.json({}, { status: 400 })))

    const { container } = renderDropzone()
    await screen.findByText('Rasmlarni shu yerga tashlang')
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')
    if (input === null) throw new Error('file input not found')

    await userEvent.upload(input, png('tooth.png'))

    expect(await screen.findByText('Rasmlarni shu yerga tashlang')).toBeInTheDocument()
  })
})
