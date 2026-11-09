import { cn } from '@/shared/lib/cn'
import { PHONE_QUERY, useMediaQuery } from '@/shared/lib/useMediaQuery'

export interface BarChartDatum {
  key: string
  /** Axis and tooltip label. */
  label: string
  value: number
  /** A part of `value` drawn inside its bar, e.g. "completed" of "booked". In `paired` mode, a second series. */
  part?: number
}

export interface BarChartProps {
  data: readonly BarChartDatum[]
  /** Names the chart for assistive tech; the table below carries the numbers. */
  label: string
  valueLabel: string
  /** Legend and tooltip name for `part`. Leave out for a single series. */
  partLabel?: string
  /** At most this many axis labels, so a 30-day month does not collide. */
  maxAxisLabels?: number
  /** Tooltip and table text for a value, e.g. money. */
  formatValue?: (value: number) => string
  /**
   * Draw `part` as its own column beside `value` instead of inside it. For two
   * independent series: money collected on a day can exceed the work billed
   * that day (old debt paid), and drawn inside the bar it would vanish.
   */
  paired?: boolean
  className?: string
}

/**
 * Columns from a zero baseline, plain HTML so it reflows at 360px without a
 * chart library (no new dependency). One axis, one hue: the part is the solid
 * accent, the rest of the column a tint of it, and a legend names both.
 *
 * Hover shows a tooltip; the visually hidden table is what a screen reader
 * or a keyboard user's assistive tech reads instead.
 */
export function BarChart({
  data,
  label,
  valueLabel,
  partLabel,
  maxAxisLabels = 8,
  formatValue = String,
  paired = false,
  className,
}: BarChartProps) {
  const max = Math.max(
    1,
    ...data.map((datum) => (paired ? Math.max(datum.value, datum.part ?? 0) : datum.value)),
  )
  // Half as many labels on a phone: "12 okt" needs about a tenth of 360px.
  const axisLabels = useMediaQuery(PHONE_QUERY) ? Math.ceil(maxAxisLabels / 2) : maxAxisLabels
  const labelStep = Math.max(1, Math.ceil(data.length / axisLabels))

  return (
    <figure className={cn('flex flex-col gap-3', className)}>
      {partLabel === undefined ? null : (
        <figcaption className="flex flex-wrap gap-4 text-caption text-text-secondary">
          <LegendSwatch className="bg-accent" label={partLabel} />
          <LegendSwatch className="bg-accent/35" label={valueLabel} />
        </figcaption>
      )}

      <div aria-hidden="true" className="flex h-48 items-end gap-1 border-b border-border">
        {data.map((datum, index) => (
          <div
            className="group relative flex h-full min-w-0 flex-1 items-end gap-px"
            key={datum.key}
          >
            {paired ? (
              <>
                <div
                  className="w-1/2 rounded-t bg-accent/35 transition-opacity duration-150 ease-out-apple group-hover:opacity-80"
                  style={{ height: `${(datum.value / max) * 100}%` }}
                />
                <div
                  className="w-1/2 rounded-t bg-accent transition-opacity duration-150 ease-out-apple group-hover:opacity-80"
                  style={{ height: `${((datum.part ?? 0) / max) * 100}%` }}
                />
              </>
            ) : (
              <div
                className={cn(
                  'relative w-full rounded-t transition-opacity duration-150 ease-out-apple group-hover:opacity-80',
                  // A single series is the solid accent; the tint only means "the rest" beside a part.
                  partLabel === undefined ? 'bg-accent' : 'bg-accent/35',
                )}
                style={{ height: `${(datum.value / max) * 100}%` }}
              >
                {datum.part === undefined || datum.value === 0 ? null : (
                  <div
                    className="absolute inset-x-0 bottom-0 rounded-t bg-accent"
                    // A part larger than its whole (e.g. old debt paid this month) fills the bar, never overflows it.
                    style={{ height: `${Math.min(1, datum.part / datum.value) * 100}%` }}
                  />
                )}
              </div>
            )}
            <div
              className={cn(
                'pointer-events-none absolute bottom-full z-10 mb-2 hidden flex-col gap-1 group-hover:flex',
                'rounded-control border border-border bg-elevated px-3 py-2 shadow-card',
                'text-caption whitespace-nowrap text-text',
                // Keep the tooltip inside the chart at both ends.
                index < data.length / 3
                  ? 'left-0'
                  : index >= (data.length * 2) / 3
                    ? 'right-0'
                    : 'left-1/2 -translate-x-1/2',
              )}
            >
              <span className="font-medium">{datum.label}</span>
              <span className="text-text-secondary tabular-nums">
                {valueLabel}: {formatValue(datum.value)}
              </span>
              {datum.part === undefined || partLabel === undefined ? null : (
                <span className="text-text-secondary tabular-nums">
                  {partLabel}: {formatValue(datum.part)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div aria-hidden="true" className="flex gap-1">
        {data.map((datum, index) => (
          <span
            className="min-w-0 flex-1 overflow-visible text-center text-caption whitespace-nowrap text-text-tertiary"
            key={datum.key}
          >
            {index % labelStep === 0 ? datum.label : ''}
          </span>
        ))}
      </div>

      {/* On a wrapper, not the table: a table ignores `width: 1px` and widened the page on phones. */}
      <div className="sr-only">
        <table>
          <caption>{label}</caption>
          <thead>
            <tr>
              <th scope="col">{label}</th>
              <th scope="col">{valueLabel}</th>
              {partLabel === undefined ? null : <th scope="col">{partLabel}</th>}
            </tr>
          </thead>
          <tbody>
            {data.map((datum) => (
              <tr key={datum.key}>
                <th scope="row">{datum.label}</th>
                <td>{formatValue(datum.value)}</td>
                {partLabel === undefined ? null : (
                  <td>{datum.part === undefined ? '' : formatValue(datum.part)}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  )
}

export function LegendSwatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span aria-hidden="true" className={cn('size-3 rounded', className)} />
      {label}
    </span>
  )
}
