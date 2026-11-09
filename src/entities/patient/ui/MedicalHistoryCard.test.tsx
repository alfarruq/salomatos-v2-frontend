import { render, screen } from '@testing-library/react'
import { Suspense } from 'react'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it } from 'vitest'
import { createI18n } from '@/shared/i18n'
import type { MedicalHistory } from '../model/medicalHistory'
import { toMedicalHistoryInput, toMedicalHistoryPayload } from '../model/medicalHistory'
import { MedicalHistoryCard } from './MedicalHistoryCard'

const EMPTY: MedicalHistory = {
  allergies: null,
  chronicConditions: null,
  currentMedications: null,
  isPregnant: null,
  notes: null,
  updatedAt: null,
}

function renderCard(history: MedicalHistory, showPregnancy = true) {
  render(
    <I18nextProvider i18n={createI18n('uz-Latn')}>
      <Suspense fallback={null}>
        <MedicalHistoryCard history={history} showPregnancy={showPregnancy} />
      </Suspense>
    </I18nextProvider>,
  )
}

describe('MedicalHistoryCard', () => {
  it('asks for the anamnesis when nothing is recorded', async () => {
    renderCard(EMPTY)
    expect(await screen.findByText(/Anamnez hali to'ldirilmagan/)).toBeInTheDocument()
  })

  it('puts a recorded allergy up front', async () => {
    renderCard({ ...EMPTY, allergies: 'Penitsillin' })
    expect(await screen.findByRole('status')).toHaveTextContent('Penitsillin')
  })

  it('hides pregnancy for a male patient', async () => {
    renderCard({ ...EMPTY, chronicConditions: 'Diabet', isPregnant: false }, false)
    expect(await screen.findByText('Diabet')).toBeInTheDocument()
    expect(screen.queryByText('Homilador emas')).not.toBeInTheDocument()
  })
})

describe('medical history form mapping', () => {
  it('keeps "not asked" apart from "no" and trims text', () => {
    const input = toMedicalHistoryInput(EMPTY)
    expect(toMedicalHistoryPayload({ ...input, allergies: '  Lateks ' })).toEqual({
      allergies: 'Lateks',
      chronic_conditions: '',
      current_medications: '',
      is_pregnant: null,
      notes: '',
    })
    expect(toMedicalHistoryPayload({ ...input, isPregnant: 'no' }).is_pregnant).toBe(false)
  })
})
