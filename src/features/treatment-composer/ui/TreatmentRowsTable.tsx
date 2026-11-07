import { Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { TreatmentType } from '@/entities/treatment-type'
import { cn } from '@/shared/lib/cn'
import { formatSom } from '@/shared/lib/money'
import { Button, Checkbox, Input, MoneyInput, Select } from '@/shared/ui'
import { lineTotalOf } from '../model/formSchema'
import type { TreatmentRow } from '../model/types'

export interface TreatmentRowsTableProps {
  rows: TreatmentRow[]
  treatmentTypes: TreatmentType[]
  onRowChange: (rowId: string, changes: Partial<TreatmentRow>) => void
  onRemoveRow: (rowId: string) => void
  /** Off when no row is tooth work. */
  showToothColumn: boolean
}

/*
 * One grid template for the header and every row, so the columns line up
 * without a `<table>` — which could not reflow into the stacked card each
 * row becomes below `lg`, where six inputs side by side do not fit.
 */
const withTooth =
  'lg:grid-cols-[48px_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)_44px]'
const withoutTooth =
  'lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)_44px]'

/** Visible only on a phone, where the column header is gone; the header names it on desktop. */
function CellLabel({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  const className = 'text-caption text-text-tertiary lg:sr-only'
  return htmlFor === undefined ? (
    <span className={className}>{children}</span>
  ) : (
    <label className={className} htmlFor={htmlFor}>
      {children}
    </label>
  )
}

function Amount({ children }: { children: ReactNode }) {
  return <span className="font-mono whitespace-nowrap text-text tabular-nums">{children}</span>
}

/**
 * The rows being recorded, added from `ToothPicker` above and edited here.
 * Price and discount start at the price list's figures and may be changed per
 * line; once saved, the line is append-only.
 */
export function TreatmentRowsTable({
  rows,
  treatmentTypes,
  onRowChange,
  onRemoveRow,
  showToothColumn,
}: TreatmentRowsTableProps) {
  const { t, i18n } = useTranslation(['treatments', 'patients', 'common'])
  const currencyLabel = t('common:currency.som')
  const som = (amount: number) => formatSom(amount, i18n.language, currencyLabel)
  const typeOptions = treatmentTypes.map((type) => ({ value: type.id, label: type.name }))
  const columns = showToothColumn ? withTooth : withoutTooth

  const total = rows.reduce((sum, row) => sum + lineTotalOf(row), 0)

  return (
    <section aria-labelledby="treatment-rows-title" className="flex flex-col gap-3">
      <h3 className="text-body font-semibold text-text" id="treatment-rows-title">
        {t('treatments:composer.rowsTitle', { total: rows.length })}
      </h3>

      {rows.length === 0 ? (
        <p className="rounded-card border border-dashed border-border p-4 text-center text-callout text-text-secondary">
          {t('treatments:composer.rowsEmpty')}
        </p>
      ) : (
        <div className="flex flex-col gap-3 lg:gap-0">
          <div
            aria-hidden="true"
            className={cn(
              'hidden items-center gap-3 border-b border-border px-3 pb-2 text-caption text-text-tertiary lg:grid',
              columns,
            )}
          >
            {showToothColumn ? <span>{t('treatments:table.columnTooth')}</span> : null}
            <span>{t('treatments:composer.rowType')}</span>
            <span className="text-right">{t('treatments:composer.rowCost')}</span>
            <span className="text-right">{t('treatments:composer.rowDiscount')}</span>
            <span>{t('treatments:composer.rowStage')}</span>
            <span className="text-right">{t('treatments:composer.rowTotal')}</span>
            <span />
          </div>

          <ul className="flex flex-col gap-3 lg:gap-0">
            {rows.map((row) => {
              const rowName =
                row.toothNumber === null
                  ? row.treatmentTypeName
                  : `${t('treatments:table.columnTooth')} ${row.toothNumber}`

              return (
                <li
                  className={cn(
                    // Phone: a bordered card, two inputs per line.
                    'grid grid-cols-2 items-center gap-3 rounded-card border border-border p-3',
                    // Desktop: one dense line per row, separated like a table.
                    'lg:rounded-none lg:border-0 lg:border-b lg:px-3 lg:py-2',
                    columns,
                  )}
                  key={row.rowId}
                >
                  {/* Phone header line: tooth, type and delete share the top of the card. */}
                  <div className="col-span-2 flex items-center gap-3 lg:contents">
                    {showToothColumn ? (
                      row.toothNumber === null ? (
                        <span className="text-text-tertiary">—</span>
                      ) : (
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-accent-soft text-callout font-semibold text-accent-text">
                          {row.toothNumber}
                        </span>
                      )
                    ) : null}

                    <Select
                      aria-label={`${t('treatments:composer.rowType')} — ${rowName}`}
                      className="min-w-0 flex-1"
                      onValueChange={(value) => {
                        const type = treatmentTypes.find((candidate) => candidate.id === value)
                        onRowChange(row.rowId, {
                          treatmentTypeId: type?.id ?? null,
                          treatmentTypeName: type?.name ?? row.treatmentTypeName,
                          ...(type === undefined ? {} : { unitPrice: String(type.price) }),
                        })
                      }}
                      options={typeOptions}
                      size="sm"
                      {...(row.treatmentTypeName === ''
                        ? {}
                        : { placeholder: row.treatmentTypeName })}
                      {...(row.treatmentTypeId === null ? {} : { value: row.treatmentTypeId })}
                    />

                    <Button
                      aria-label={`${t('common:action.delete')} — ${rowName}`}
                      className="shrink-0 lg:order-last"
                      onClick={() => onRemoveRow(row.rowId)}
                      size="sm"
                      variant="ghost"
                    >
                      <Trash2 aria-hidden="true" className="size-4" />
                    </Button>
                  </div>

                  <div className="flex min-w-0 flex-col gap-1">
                    <CellLabel htmlFor={`${row.rowId}-cost`}>
                      {t('treatments:composer.rowCost')}
                    </CellLabel>
                    <MoneyInput
                      id={`${row.rowId}-cost`}
                      className="h-9 px-3 text-right text-callout pointer-coarse:min-h-11"
                      onChange={(value) => onRowChange(row.rowId, { unitPrice: value })}
                      placeholder="0"
                      value={row.unitPrice}
                    />
                  </div>

                  <div className="flex min-w-0 flex-col gap-1">
                    <CellLabel htmlFor={`${row.rowId}-discount`}>
                      {t('treatments:composer.rowDiscount')}
                    </CellLabel>
                    <Input
                      className="text-right"
                      id={`${row.rowId}-discount`}
                      inputMode="numeric"
                      onChange={(event) =>
                        onRowChange(row.rowId, {
                          discountPercent: event.target.value.replace(/\D/g, '').slice(0, 3),
                        })
                      }
                      placeholder="0"
                      size="sm"
                      value={row.discountPercent}
                    />
                  </div>

                  <Checkbox
                    checked={row.inProgress}
                    className="col-span-2 lg:col-span-1"
                    id={`${row.rowId}-in-progress`}
                    label={t('treatments:composer.rowInProgress')}
                    onCheckedChange={(checked) =>
                      onRowChange(row.rowId, { inProgress: checked === true })
                    }
                  />

                  <div className="flex min-w-0 flex-col gap-1 lg:items-end">
                    <CellLabel>{t('treatments:composer.rowTotal')}</CellLabel>
                    <span className="flex h-9 items-center text-callout">
                      <Amount>{som(lineTotalOf(row))}</Amount>
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>

          <dl className="mt-1 flex items-baseline justify-between gap-3 rounded-card bg-sunken p-3 text-callout lg:mt-3">
            <dt className="text-caption text-text-tertiary">{t('treatments:composer.rowTotal')}</dt>
            <dd className="font-medium">
              <Amount>{som(total)}</Amount>
            </dd>
          </dl>
        </div>
      )}
    </section>
  )
}
