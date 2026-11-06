import { HttpResponse, http } from 'msw'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { ApiError } from '@/shared/api/errors'
import { MOCK_PATIENTS, MOCK_PRESCRIPTIONS, mockId } from '@/shared/api/mocks/fixtures'
import { server } from '@/shared/api/mocks/server'
import { signInAs, signOut } from '@/shared/api/mocks/signIn'
import { fetchRecipes, recipeKeys } from './queries'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  signOut()
})
afterAll(() => server.close())

const AZIZA = MOCK_PATIENTS[0]?.id ?? ''
const GULNORA = MOCK_PATIENTS[2]?.id ?? ''

const page = (results: unknown[]) => ({
  count: results.length,
  next: null,
  previous: null,
  results,
})

describe('recipeKeys', () => {
  it('puts the clinic inside every key', () => {
    expect(recipeKeys.list('clinic:a', AZIZA)).toEqual([
      'clinics',
      'clinic:a',
      'recipes',
      'list',
      AZIZA,
    ])
    expect(recipeKeys.list('clinic:a', AZIZA)).not.toEqual(recipeKeys.list('clinic:b', AZIZA))
  })
})

describe('fetchRecipes', () => {
  beforeEach(() => signInAs('admin'))

  it("reads the patient's prescriptions with their medicines", async () => {
    const recipes = await fetchRecipes(AZIZA)

    expect(recipes).toEqual([
      {
        id: MOCK_PRESCRIPTIONS[0]?.id,
        doctorName: 'Sardor Usmonov',
        notes: null,
        clinicName: 'Chilonzor',
        createdAt: '2026-08-10T06:10:00Z',
        medicines: [
          {
            id: mockId(12, 1),
            name: 'Ibuprofen',
            dose: null,
            // A dose in words is kept beside the form rather than dropped.
            type: '400 mg tabletka',
            frequency: 'bid',
            timesPerDay: 2,
            duration: 3,
            meal: 'after',
            instructions: null,
          },
        ],
      },
    ])
  })

  it('maps times per day onto a frequency code and a count onto the dose', async () => {
    server.use(
      http.get('/api/v1/prescriptions/', () =>
        HttpResponse.json(
          page([
            {
              id: mockId(11, 9),
              items: [
                {
                  id: 'a',
                  medicine: 'X',
                  dose: '2',
                  form: 'tablet',
                  times_per_day: 3,
                  meal_relation: 'any',
                },
              ],
            },
          ]),
        ),
      ),
    )

    const [medicine] = (await fetchRecipes(AZIZA))[0]?.medicines ?? []
    expect(medicine?.dose).toBe(2)
    expect(medicine?.type).toBe('tablet')
    expect(medicine?.frequency).toBe('tid')
    expect(medicine?.meal).toBe('none')
  })

  it('sends the patient filter', async () => {
    let requested: string | undefined
    server.events.on('request:start', ({ request }) => {
      if (request.url.includes('/api/v1/prescriptions/')) requested = request.url
    })

    await fetchRecipes(AZIZA)

    expect(requested).toContain(`patient=${AZIZA}`)
  })

  it('is empty for a patient with no prescriptions on record', async () => {
    expect(await fetchRecipes(GULNORA)).toEqual([])
  })

  it('refuses to serve prescriptions without a token', async () => {
    signOut()

    await expect(fetchRecipes(AZIZA)).rejects.toBeInstanceOf(ApiError)
  })
})
