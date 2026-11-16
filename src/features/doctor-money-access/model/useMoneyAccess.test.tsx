import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import type { ReactNode } from 'react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MOCK_STAFF } from '@/shared/api/mocks/fixtures'
import { server } from '@/shared/api/mocks/server'
import { signInAs, signOut } from '@/shared/api/mocks/signIn'
import { useSetClinicMoney, useSetDoctorMoney } from './useMoneyAccess'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  signOut()
})
afterAll(() => server.close())

const SARDOR = MOCK_STAFF[0]
const SARDOR_ID = SARDOR?.id ?? ''

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('money access switches', () => {
  beforeEach(() => signInAs('owner'))

  it("sends only the doctor's switch and reads the row back", async () => {
    let body: unknown
    server.use(
      http.patch('/api/v1/staff/:id/', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ ...SARDOR, can_see_money: false })
      }),
    )
    const { result } = renderHook(() => useSetDoctorMoney('clinic:test'), { wrapper })

    result.current.mutate({ doctorId: SARDOR_ID, canSeeMoney: false })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(body).toEqual({ can_see_money: false })
    expect(result.current.data?.canSeeMoney).toBe(false)
  })

  it('sends only the clinic-wide switch', async () => {
    let body: unknown
    server.use(
      http.patch('/api/v1/clinic/', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Test',
          doctors_see_money: false,
        })
      }),
    )
    const { result } = renderHook(() => useSetClinicMoney('clinic:test'), { wrapper })

    result.current.mutate(false)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(body).toEqual({ doctors_see_money: false })
    expect(result.current.data?.doctorsSeeMoney).toBe(false)
  })
})
