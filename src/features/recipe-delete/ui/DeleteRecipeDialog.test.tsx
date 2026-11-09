import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { I18nextProvider } from 'react-i18next'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { toRecipe } from '@/entities/recipe'
import { MOCK_PRESCRIPTIONS } from '@/shared/api/mocks/fixtures'
import { server } from '@/shared/api/mocks/server'
import { signInAs, signOut } from '@/shared/api/mocks/signIn'
import { createI18n } from '@/shared/i18n'
import { DeleteRecipeDialog } from './DeleteRecipeDialog'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  signOut()
})
afterAll(() => server.close())

const FIRST = MOCK_PRESCRIPTIONS[0]
if (FIRST === undefined) throw new Error('fixture missing')
const RECIPE = toRecipe({ ...FIRST, items: [] })

function renderDialog() {
  const onOpenChange = vi.fn()
  render(
    <QueryClientProvider client={new QueryClient()}>
      <I18nextProvider i18n={createI18n('uz-Latn')}>
        <DeleteRecipeDialog
          clinicId="clinic:test"
          onOpenChange={onOpenChange}
          open
          recipe={RECIPE}
        />
      </I18nextProvider>
    </QueryClientProvider>,
  )
  return { onOpenChange }
}

describe('DeleteRecipeDialog', () => {
  beforeEach(() => signInAs('admin'))

  it('deletes the prescription and closes', async () => {
    let deleted = ''
    server.events.on('request:start', ({ request }) => {
      if (request.method === 'DELETE') deleted = request.url
    })
    const { onOpenChange } = renderDialog()

    await userEvent.click(await screen.findByRole('button', { name: "O'chirish" }))

    await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(deleted).toContain(`/api/v1/prescriptions/${RECIPE.id}/`)
  })

  it('stays open with a message when the server refuses', async () => {
    server.use(
      http.delete('/api/v1/prescriptions/:id/', () => HttpResponse.json({}, { status: 403 })),
    )
    const { onOpenChange } = renderDialog()

    await userEvent.click(await screen.findByRole('button', { name: "O'chirish" }))

    expect(
      await screen.findByText("Retseptni o'chirib bo'lmadi. Qaytadan urinib ko'ring."),
    ).toBeInTheDocument()
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })
})
