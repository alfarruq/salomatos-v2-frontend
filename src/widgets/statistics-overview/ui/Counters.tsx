import { useTranslation } from 'react-i18next'
import { Card } from '@/shared/ui'

/** Plain counts under a section heading: no change arrows, those are for the headline tiles. */
export function Counters({
  items,
}: {
  items: readonly { key: string; label: string; value: number }[]
}) {
  const { i18n } = useTranslation()
  const number = new Intl.NumberFormat(i18n.language)

  return (
    <dl className="grid grid-cols-2 gap-3">
      {items.map((item) => (
        <Card className="flex flex-col gap-1 p-4" key={item.key}>
          <dt className="text-caption text-text-secondary">{item.label}</dt>
          <dd className="text-title2 text-text tabular-nums">{number.format(item.value)}</dd>
        </Card>
      ))}
    </dl>
  )
}
