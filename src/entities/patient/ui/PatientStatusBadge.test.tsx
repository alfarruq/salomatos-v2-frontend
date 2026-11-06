import { render, screen } from '@testing-library/react'
import { Suspense } from 'react'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it } from 'vitest'
import { createI18n } from '@/shared/i18n'
import type { PatientStatus } from '../model/types'
import { PatientStatusBadge } from './PatientStatusBadge'

/**
 * Pinned to the product default rather than the browser's: jsdom reports
 * en-US, so these assertions would quietly start checking English and stop
 * saying anything about what staff actually see.
 *
 * Suspense because namespaces load on demand (§12.1) — the first render of a
 * screen using `patients` suspends while its chunk arrives.
 */
function renderBadge(status: PatientStatus) {
  render(
    <I18nextProvider i18n={createI18n('uz-Latn')}>
      <Suspense fallback={null}>
        <PatientStatusBadge status={status} />
      </Suspense>
    </I18nextProvider>,
  )
}

describe('PatientStatusBadge', () => {
  it('names an active card in the active language', async () => {
    renderBadge('active')

    expect(await screen.findByText('Faol')).toBeInTheDocument()
  })

  it('names an archived one', async () => {
    renderBadge('archived')

    expect(await screen.findByText('Arxivda')).toBeInTheDocument()
  })
})
