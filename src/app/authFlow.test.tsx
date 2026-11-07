import { QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Suspense } from 'react'
import { I18nextProvider } from 'react-i18next'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSessionStore } from '@/entities/session'
import { useLockStore } from '@/features/session-lock'
import { routeTree } from '@/routeTree.gen'
import { clearSession } from '@/shared/api/authSession'
import { configureApi, resetApiContext } from '@/shared/api/httpContext'
import { MOCK_CLINICS, MOCK_USERS } from '@/shared/api/mocks/fixtures'
import { server } from '@/shared/api/mocks/server'
import { signInAs } from '@/shared/api/mocks/signIn'
import { createI18n } from '@/shared/i18n'
import { IDLE_TIMEOUT_MS, IDLE_WARNING_MS } from '@/shared/lib/useIdleTimer'
import { Toaster } from '@/shared/ui'
import { createQueryClient } from './providers/queryClient'

/**
 * §16.2 scenario 1: login → dashboard → logout, driven through the real router,
 * the real guard and the real HTTP client against MSW.
 *
 * Worth doing at this level rather than per-unit: the parts that can go wrong
 * here are the seams — a guard that redirects to a page that redirects back, a
 * logout that leaves the previous user's data in the cache.
 */
function renderApp(initialPath = '/') {
  const queryClient = createQueryClient()

  // Mirrors AppProviders: token and store only. Clearing the query cache here
  // would cancel the request that reported the 401.
  configureApi({
    onUnauthorized: () => {
      clearSession()
      useSessionStore.getState().clear()
    },
  })

  const router = createRouter({
    routeTree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  })

  /*
   * Pinned to the product default rather than left to the browser: jsdom
   * reports en-US, so the assertions below would silently start checking
   * English and stop saying anything about what staff actually see.
   */
  const i18n = createI18n('uz-Latn')

  render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <Suspense fallback={null}>
          <RouterProvider router={router} />
        </Suspense>
        <Toaster />
      </I18nextProvider>
    </QueryClientProvider>,
  )

  return { queryClient, router }
}

/**
 * Stands in for a completed sign-in: the token in memory and the username
 * beside it, which is exactly the pair `useLogin` leaves behind.
 *
 * Set directly rather than typed into the form because these tests are about
 * what happens *after* authentication; the form itself is covered above.
 */
function signedIn(user: keyof typeof MOCK_USERS = 'admin') {
  signInAs(user)
  useSessionStore.getState().setUsername(MOCK_USERS[user].username)
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  resetApiContext()
  clearSession()
  useSessionStore.getState().clear()
  useLockStore.getState().unlock()
})
afterAll(() => server.close())

describe('authentication flow', () => {
  it('sends an unauthenticated visitor to the login form', async () => {
    renderApp('/dashboard')

    expect(await screen.findByRole('heading', { name: 'SalomatOS' })).toBeInTheDocument()
    expect(screen.getByLabelText('Parol')).toBeInTheDocument()
  })

  it('signs in and lands on the dashboard', async () => {
    renderApp('/login')

    await userEvent.type(await screen.findByLabelText('Foydalanuvchi nomi'), 'admin')
    await userEvent.type(screen.getByLabelText('Parol'), 'salomat')
    await userEvent.click(screen.getByRole('button', { name: 'Kirish' }))

    expect(await screen.findByRole('heading', { name: 'Boshqaruv paneli' })).toBeInTheDocument()
  })

  it('puts the server`s rejection on the form rather than in a toast', async () => {
    renderApp('/login')

    await userEvent.type(await screen.findByLabelText('Foydalanuvchi nomi'), 'admin')
    await userEvent.type(screen.getByLabelText('Parol'), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: 'Kirish' }))

    /*
     * §10, and the reason `message_key` is carried on ApiError: the server
     * says "Invalid username or password" in English whatever locale the staff
     * member is using, so the key is translated and the prose is only a
     * fallback.
     */
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Foydalanuvchi nomi yoki parol noto'g'ri",
    )
  })

  it('does not show the login form to someone already signed in', async () => {
    signedIn()
    renderApp('/login')

    expect(await screen.findByRole('heading', { name: 'Boshqaruv paneli' })).toBeInTheDocument()
  })

  it('turns away a user who belongs to no clinic', async () => {
    // A valid token with no active membership reaches nothing in the app.
    signedIn('orphan')
    renderApp('/dashboard')

    expect(await screen.findByText("Klinikaga kirish yo'q")).toBeInTheDocument()
    // Back at the form, not inside the shell.
    expect(screen.getByLabelText('Parol')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Boshqaruv paneli' })).not.toBeInTheDocument()
  })

  it('keeps a doctor out of clinic administration', async () => {
    /*
     * A doctor has no `staff:manage`. Reaching /manage returns them to the
     * dashboard; the server would refuse every request there with 403 anyway.
     */
    signedIn('doctor')
    renderApp('/manage/doctors')

    expect(await screen.findByRole('heading', { name: 'Boshqaruv paneli' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Boshqaruv' })).not.toBeInTheDocument()
  })

  it("keeps a branch admin out of administration too: staff and pay are the owner's", async () => {
    signedIn('admin')
    renderApp('/manage/doctors')

    expect(await screen.findByRole('heading', { name: 'Boshqaruv paneli' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Boshqaruv' })).not.toBeInTheDocument()
  })

  it('lets the owner into administration', async () => {
    signedIn('owner')
    renderApp('/manage/doctors')

    expect(await screen.findByRole('heading', { name: 'Boshqaruv' })).toBeInTheDocument()
    expect(await screen.findByText('Sardor Usmonov')).toBeInTheDocument()
  })

  it('does not leave a rejected user signed in', async () => {
    signedIn('orphan')
    renderApp('/dashboard')

    await screen.findByText("Klinikaga kirish yo'q")

    // Otherwise /login would see a cached session and bounce them back into
    // the guard, which would bounce them out again.
    expect(useSessionStore.getState().session).toBeNull()
  })
})

describe('logout', () => {
  beforeEach(() => signedIn())

  it('clears the cache and the token so the next member of staff sees nothing', async () => {
    const { queryClient } = renderApp('/dashboard')

    await screen.findByRole('heading', { name: 'Boshqaruv paneli' })
    expect(queryClient.getQueryCache().getAll().length).toBeGreaterThan(0)

    await userEvent.click(screen.getByRole('button', { name: MOCK_USERS.admin.full_name }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Chiqish' }))

    // §13.4 — a shared reception desk is the reason this is not optional.
    await waitFor(() => {
      expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
      expect(useSessionStore.getState().session).toBeNull()
    })
  })
})

describe('idle lock', () => {
  /*
   * Fake timers must be in place before the component mounts, or the idle
   * timeout is scheduled with the real `setTimeout` and advancing fake time
   * moves nothing. `shouldAdvanceTime` keeps promises and MSW working while
   * still allowing a deliberate jump forward.
   */
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    signedIn()
  })
  afterEach(() => vi.useRealTimers())

  async function goIdle() {
    await screen.findByRole('heading', { name: 'Boshqaruv paneli' })
    await act(async () => {
      vi.advanceTimersByTime(IDLE_TIMEOUT_MS)
    })
    return screen.findByRole('heading', { name: 'Ekran qulflangan' })
  }

  it('locks the screen and drops the patient data behind it', async () => {
    const { queryClient } = renderApp('/dashboard')
    await screen.findByRole('heading', { name: 'Boshqaruv paneli' })

    // Keyed the way §6.2 requires, with the tenant id the session resolved to.
    const patientsKey = ['clinics', `clinic:${MOCK_CLINICS.main.id}`, 'patients']
    queryClient.setQueryData(patientsKey, ['Vali Aliyev'])

    await act(async () => {
      vi.advanceTimersByTime(IDLE_TIMEOUT_MS)
    })
    expect(await screen.findByRole('heading', { name: 'Ekran qulflangan' })).toBeInTheDocument()

    /*
     * §13.4 — the overlay is not what protects anything. Clearing the cache
     * is: an overlay alone would leave the patient record in the DOM, one
     * devtools panel or one screenshot away.
     *
     * The session query comes back on its own, because the layout still
     * subscribes to it. That is fine and not what is being protected: it is
     * the signed-in user's own name and permissions, not a patient's record.
     */
    expect(queryClient.getQueryData(patientsKey)).toBeUndefined()
    expect(screen.queryByRole('heading', { name: 'Boshqaruv paneli' })).not.toBeInTheDocument()
  })

  it('names who is locked out, and nothing about a patient', async () => {
    renderApp('/dashboard')
    await goIdle()

    // Identity is the only thing that survives a lock, and it is on screen in
    // a public room.
    expect(screen.getByText(new RegExp(MOCK_USERS.admin.full_name))).toBeInTheDocument()
  })

  it('warns before locking so the user can stay', async () => {
    renderApp('/dashboard')
    await screen.findByRole('heading', { name: 'Boshqaruv paneli' })

    await act(async () => {
      vi.advanceTimersByTime(IDLE_TIMEOUT_MS - IDLE_WARNING_MS)
    })

    expect(await screen.findByText('Ekran tez orada qulflanadi')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Ekran qulflangan' })).not.toBeInTheDocument()
  })

  it('comes back to the dashboard on the right password', async () => {
    renderApp('/dashboard')
    await goIdle()

    await user.type(screen.getByLabelText('Parol'), 'salomat')
    await user.click(screen.getByRole('button', { name: 'Qulfni ochish' }))

    expect(await screen.findByRole('heading', { name: 'Boshqaruv paneli' })).toBeInTheDocument()
  })

  it('stays locked on the wrong password', async () => {
    renderApp('/dashboard')
    await goIdle()

    await user.type(screen.getByLabelText('Parol'), 'wrong')
    await user.click(screen.getByRole('button', { name: 'Qulfni ochish' }))

    expect(await screen.findByText("Parol noto'g'ri")).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Ekran qulflangan' })).toBeInTheDocument()
  })
})
