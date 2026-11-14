import { Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TreatmentType } from '@/entities/treatment-type'
import { formatSom } from '@/shared/lib/money'
import { Input } from '@/shared/ui'
import type { TreatmentRow } from '../model/types'

export interface TreatmentTypeAdderProps {
  treatmentTypes: TreatmentType[]
  rows: TreatmentRow[]
  onAdd: (treatmentType: TreatmentType) => void
}

// Below this a search box is clutter: the whole list fits at a glance.
const SEARCH_FROM = 7

/**
 * `ToothPicker`'s counterpart for a non-dental doctor: no chart, the doctor's
 * own services as tiles. A tap adds a row, so the same service tapped twice
 * adds a second one; the tile shows how many are already on the visit.
 */
export function TreatmentTypeAdder({ treatmentTypes, rows, onAdd }: TreatmentTypeAdderProps) {
  const { t, i18n } = useTranslation(['treatments', 'common'])
  const [query, setQuery] = useState('')

  const needle = query.trim().toLocaleLowerCase()
  const shown =
    needle === ''
      ? treatmentTypes
      : treatmentTypes.filter(
          (type) =>
            type.name.toLocaleLowerCase().includes(needle) ||
            (type.code ?? '').toLocaleLowerCase().includes(needle),
        )

  const added = new Map<string, number>()
  for (const row of rows) {
    if (row.treatmentTypeId === null) continue
    added.set(row.treatmentTypeId, (added.get(row.treatmentTypeId) ?? 0) + 1)
  }

  return (
    <div className="flex flex-col gap-3">
      {treatmentTypes.length < SEARCH_FROM ? null : (
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-secondary"
          />
          <Input
            aria-label={t('treatments:composer.serviceSearch')}
            className="pl-9"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('treatments:composer.serviceSearch')}
            size="sm"
            type="search"
            value={query}
          />
        </div>
      )}

      {shown.length === 0 ? (
        <p className="py-6 text-center text-callout text-text-secondary">
          {t('treatments:composer.serviceNoMatch')}
        </p>
      ) : (
        <ul className="grid max-h-80 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
          {shown.map((type) => {
            const count = added.get(type.id) ?? 0
            return (
              <li key={type.id}>
                <button
                  aria-label={`${t('treatments:composer.addService')} — ${type.name}`}
                  className={
                    count > 0
                      ? 'flex min-h-11 w-full items-center justify-between gap-3 rounded-control border border-accent bg-accent-soft px-3 py-2 text-left transition-[border-color,background-color] duration-150 ease-out-apple'
                      : 'flex min-h-11 w-full items-center justify-between gap-3 rounded-control border border-border bg-surface px-3 py-2 text-left transition-[border-color,background-color] duration-150 ease-out-apple hover:border-border-strong hover:bg-sunken'
                  }
                  onClick={() => onAdd(type)}
                  type="button"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-callout text-text">{type.name}</span>
                    <span className="text-caption text-text-secondary">
                      {formatSom(type.price, i18n.language, t('common:currency.som'))}
                    </span>
                  </span>
                  {count > 0 ? (
                    <span className="shrink-0 text-caption text-accent-text">×{count}</span>
                  ) : (
                    <Plus aria-hidden="true" className="size-4 shrink-0 text-text-secondary" />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
