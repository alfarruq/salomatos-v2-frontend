import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import type { ReactNode } from 'react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MOCK_STAFF, mockId } from '@/shared/api/mocks/fixtures'
import { server } from '@/shared/api/mocks/server'
import { signInAs, signOut } from '@/shared/api/mocks/signIn'
import { useUpdateDoctor } from './useUpdateDoctor'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  signOut()
})
afterAll(() => server.close())

const SARDOR = MOCK_STAFF[0]
const SARDOR_ID = SARDOR?.id ?? ''

const INPUT = {
  username: 'sardor',
  password: '',
  fullName: 'Sardor Usmonov',
  phoneNumber: '+998901112244',
  email: '',
  doctorTypeId: mockId(5, 1),
}

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

function captureBody(): { body: unknown } {
  const captured: { body: unknown } = { body: undefined }
  server.use(
    http.patch('/api/v1/staff/:id/', async ({ request }) => {
      captured.body = await request.json()
      return HttpResponse.json(SARDOR)
    }),
  )
  return captured
}

describe('useUpdateDoctor', () => {
  beforeEach(() => signInAs('admin'))

  it('sends the specialty as its id', async () => {
    const captured = captureBody()
    const { result } = renderHook(() => useUpdateDoctor('clinic:test'), { wrapper })
    result.current.mutate({ doctorId: SARDOR_ID, input: { ...INPUT, doctorTypeId: mockId(5, 2) } })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(captured.body).toMatchObject({ role: 'doctor', specialty: mockId(5, 2) })
  })

  it('keeps the current password when the field was left empty', async () => {
    const captured = captureBody()
    const { result } = renderHook(() => useUpdateDoctor('clinic:test'), { wrapper })
    result.current.mutate({ doctorId: SARDOR_ID, input: INPUT })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(captured.body).toMatchObject({ username: 'sardor' })
    expect(captured.body).not.toHaveProperty('password')
  })

  it('sends a new password once one is typed', async () => {
    const captured = captureBody()
    const { result } = renderHook(() => useUpdateDoctor('clinic:test'), { wrapper })
    result.current.mutate({ doctorId: SARDOR_ID, input: { ...INPUT, password: 'yangi-parol' } })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(captured.body).toMatchObject({ password: 'yangi-parol' })
  })

  it('saves through the mock server end to end', async () => {
    const { result } = renderHook(() => useUpdateDoctor('clinic:test'), { wrapper })
    result.current.mutate({ doctorId: SARDOR_ID, input: { ...INPUT, fullName: 'Sardor U.' } })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.fullName).toBe('Sardor U.')
  })
})
