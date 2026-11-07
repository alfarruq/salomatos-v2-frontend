import { motion } from 'motion/react'
import type { KeyboardEvent, MouseEvent } from 'react'
import { useId, useMemo, useRef, useState } from 'react'
import { cn } from '@/shared/lib/cn'
import { springs, useMotionDisabled, useTransition } from '@/shared/lib/motion'

/**
 * An interactive FDI (ISO 3950) tooth chart — the arch geometry behind both
 * the composer's tooth picker and the read-only chart on the patient's
 * "General" tab, so the two draw teeth from one definition rather than two.
 *
 * Ported from a standalone component built outside this project. What
 * changed in the port: colour is a Tailwind class string, never a literal
 * value (§11 — `@theme` tokens only), every spring comes from
 * `shared/lib/motion` instead of an inline preset, and every label is a
 * required prop — there is no built-in English or Uzbek text, because a
 * `shared/ui` component may not decide the user's language (§12).
 */

export type FDI = string

export type ToothType = 'incisor' | 'canine' | 'premolar' | 'molar'

export type Quadrant = 1 | 2 | 3 | 4

export interface ToothStatusDef {
  id: string
  /** Tailwind fill utility, e.g. `"fill-accent-soft"`. */
  fillClassName: string
  /** Tailwind stroke/text utility — shared by the crown's outline and its fissure lines. */
  strokeClassName: string
  /** Shown in the native tooltip and the aria-label. */
  label?: string
  /**
   * Diagonal stripes over the fill, drawn with `strokeClassName`. A state told
   * apart by colour alone is lost on a colour-blind reader, so a second state
   * of the same chart should carry a pattern.
   */
  hatched?: boolean
  /** A small badge at the tooth's centre: a tick for finished work, a clock for work under way. */
  marker?: 'check' | 'clock'
  /** Fill utility of the marker's disc, e.g. `"fill-success"`. Required with `marker`. */
  markerClassName?: string
  /** Fill/text utility for the FDI number of a tooth in this state, e.g. `"fill-success"`. */
  numberClassName?: string
}

export interface ToothMeta {
  fdi: FDI
  quadrant: Quadrant
  type: ToothType
  /** 0-based position within its own row (0 = far left of that jaw). */
  index: number
}

export interface DentalChartLabels {
  incisor: string
  canine: string
  premolar: string
  molar: string
  upper: string
  lower: string
  tooth: string
}

export interface DentalChartProps {
  /** FDI number → status id, e.g. `{ "16": "selected", "24": "completed" }`. */
  values?: Record<FDI, string>
  statuses: ToothStatusDef[]
  labels: DentalChartLabels
  layout?: 'arch' | 'row'
  selectedTeeth?: FDI[]
  disabledTeeth?: FDI[]
  /** e.g. hide the wisdom teeth with `["18", "28", "38", "48"]`. */
  hiddenTeeth?: FDI[]
  showNumbers?: boolean
  showQuadrantLines?: boolean
  /** Writes `labels.upper` / `labels.lower` inside each arch. Arch layout only. */
  showJawLabels?: boolean
  /**
   * Caps how wide the chart may grow, so it stays readable instead of
   * stretching across a large screen. Any CSS length; default 440px.
   * Pass `"none"` to let it fill its container.
   */
  maxWidth?: number | string
  onToothClick?: (fdi: FDI, event: MouseEvent | KeyboardEvent, element: SVGGElement) => void
  onToothHover?: (fdi: FDI | null) => void
  className?: string
}

// ── Geometry — the whole arch is driven from here, no colour involved ──

const VIEWBOX = { width: 300, height: 192 } as const

/**
 * Each jaw sits on its own half-ellipse. The two centres are pulled apart
 * vertically so a clear gap (the occlusal midline) opens between the rows.
 *
 * The radii are tuned so the ellipse's half-perimeter (~311px) is just wider
 * than the 262px of tooth widths in a row, leaving a uniform ~3px gap between
 * neighbours (see SLOTS) — tight arch, short chart.
 */
const ARCH = {
  cx: VIEWBOX.width / 2,
  /** Centre of the upper half-ellipse; its arc bulges upward. */
  upperCy: 88,
  /** Centre of the lower half-ellipse; its arc bulges downward. */
  lowerCy: 104,
  radiusX: 128,
  radiusY: 65,
  /** Sweep of one jaw, in degrees, measured on the ellipse. */
  startAngle: 180,
  endAngle: 360,
  /** How far outside the arc the FDI numbers are drawn. */
  numberOffset: 16,
} as const

/** Flat two-row fallback layout. */
const ROW = {
  startX: 6,
  step: 18,
  upperY: 70,
  lowerY: 125,
  numberOffset: 16,
} as const

const TEETH_PER_ROW = 16

/** Bounding sizes per tooth type — used for hit-area and spacing decisions. */
const TOOTH_SIZE: Record<ToothType, { width: number; height: number }> = {
  incisor: { width: 15, height: 18 },
  canine: { width: 15, height: 21 },
  premolar: { width: 16, height: 15 },
  molar: { width: 18, height: 17 },
}

/**
 * Hit-area floor, in viewBox units. Kept just under the ~19.5px slot so
 * neighbouring targets never overlap; at a typical rendered width (≥600px this
 * scales by 2×) it still clears the 32px physical touch-target guideline.
 */
const MIN_HIT_SIZE = 18

// ── Tooth silhouettes — occlusal (top-down) view, drawn around (0,0) ──

interface ToothShape {
  /** Outer silhouette. */
  outline: string
  /** Inner surface lines (fissures / ridges) that make the tooth read as real. */
  detail: string
}

const SHAPES: Record<ToothType, ToothShape> = {
  // Narrow and rectangular with a straight incisal edge. (15 × 18)
  incisor: {
    outline:
      'M -6.5 -9 Q -7.5 -9 -7.5 -7.5 L -7 6.5 Q -7 9 -4.5 9 L 4.5 9 Q 7 9 7 6.5 L 7.5 -7.5 Q 7.5 -9 6.5 -9 Z',
    detail: 'M -4.5 6 L 4.5 6',
  },
  // Pointed and slightly elongated, with a central ridge. (15 × 21)
  canine: {
    outline:
      'M -6.5 -10.5 Q -7.5 -10.5 -7.5 -9 L -6.5 3 Q -6 9 0 10.5 Q 6 9 6.5 3 L 7.5 -9 Q 7.5 -10.5 6.5 -10.5 Z',
    detail: 'M 0 -4.5 L 0 8',
  },
  // Oval with two cusps split by a mesio-distal fissure. (16 × 15)
  premolar: {
    outline:
      'M 0 -7.5 Q 6 -7.5 7.5 -4 Q 8 0 7.5 4 Q 6 7.5 0 7.5 Q -6 7.5 -7.5 4 Q -8 0 -7.5 -4 Q -6 -7.5 0 -7.5 Z',
    detail: 'M -4.5 0 L 4.5 0',
  },
  // Wide and near-square with a four-cusp cross fissure. (18 × 17)
  molar: {
    outline:
      'M -6.5 -8.5 Q -9 -8.5 -9 -6 L -9 6 Q -9 8.5 -6.5 8.5 L 6.5 8.5 Q 9 8.5 9 6 L 9 -6 Q 9 -8.5 6.5 -8.5 Z',
    detail: 'M 0 -6 L 0 6 M -6.5 0 L 6.5 0',
  },
}

/** Tooth type follows the second FDI digit: 1–2 incisor, 3 canine, 4–5 premolar, 6–8 molar. */
function typeFromFdi(fdi: FDI): ToothType {
  const position = Number(fdi[1])
  if (position <= 2) return 'incisor'
  if (position === 3) return 'canine'
  if (position <= 5) return 'premolar'
  return 'molar'
}

/** Row order, left → right on screen, exactly as the spec lists it. */
const UPPER_ORDER: FDI[] = [
  '18',
  '17',
  '16',
  '15',
  '14',
  '13',
  '12',
  '11',
  '21',
  '22',
  '23',
  '24',
  '25',
  '26',
  '27',
  '28',
]
const LOWER_ORDER: FDI[] = [
  '48',
  '47',
  '46',
  '45',
  '44',
  '43',
  '42',
  '41',
  '31',
  '32',
  '33',
  '34',
  '35',
  '36',
  '37',
  '38',
]

export const TEETH: ToothMeta[] = [...UPPER_ORDER, ...LOWER_ORDER].map((fdi, i) => ({
  fdi,
  quadrant: Number(fdi[0]) as Quadrant,
  type: typeFromFdi(fdi),
  index: i % TEETH_PER_ROW,
}))

const isUpper = (fdi: FDI) => fdi[0] === '1' || fdi[0] === '2'

// ── Arch maths (pure) ──

export interface ToothTransform {
  x: number
  y: number
  /** Degrees; rotates the crown so it faces out along the arch. */
  angle: number
  /** Where the always-horizontal FDI label sits, just outside the arc. */
  labelX: number
  labelY: number
}

const toRad = (deg: number) => (deg * Math.PI) / 180

/**
 * Equal steps in θ do NOT give equal spacing on an ellipse: the arc speed
 * |dP/dθ| = √(rx²sin²θ + ry²cos²θ) peaks at the front of the arch (rx) and
 * bottoms out at the sides (ry). With rx=128 / ry=65 that is a ~2× difference,
 * which shows up as gappy front teeth and cramped molars.
 *
 * So the sweep is sampled once into a cumulative arc-length table, and teeth
 * are placed by *distance along the curve* instead of by angle.
 */
function buildArcTable(steps = 720) {
  const { radiusX: rx, radiusY: ry, startAngle, endAngle } = ARCH
  const speed = (deg: number) => Math.hypot(rx * Math.sin(toRad(deg)), ry * Math.cos(toRad(deg)))

  const dTheta = (endAngle - startAngle) / steps
  const thetas: number[] = [startAngle]
  const lengths: number[] = [0]
  let acc = 0
  // Trapezoidal integration of the speed over the sweep.
  for (let i = 1; i <= steps; i += 1) {
    const prev = startAngle + (i - 1) * dTheta
    const curr = startAngle + i * dTheta
    acc += ((speed(prev) + speed(curr)) / 2) * toRad(dTheta)
    thetas.push(curr)
    lengths.push(acc)
  }
  return { thetas, lengths, total: acc }
}

const ARC_TABLE = buildArcTable()

/** Inverse lookup: arc length → θ, binary search plus linear interpolation. */
function thetaAtArcLength(distance: number): number {
  const { thetas, lengths, total } = ARC_TABLE
  const target = Math.min(Math.max(distance, 0), total)
  let lo = 0
  let hi = lengths.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    // `lo`/`hi` only ever narrow toward each other within [0, length - 1],
    // so both indices stay in bounds — the `?? 0` is unreachable, not a guess.
    if ((lengths[mid] ?? 0) <= target) lo = mid
    else hi = mid
  }
  const lengthLo = lengths[lo] ?? 0
  const lengthHi = lengths[hi] ?? 0
  const thetaLo = thetas[lo] ?? 0
  const thetaHi = thetas[hi] ?? 0
  const span = lengthHi - lengthLo
  const f = span === 0 ? 0 : (target - lengthLo) / span
  return thetaLo + (thetaHi - thetaLo) * f
}

/**
 * Arc-length centre of every slot. Each tooth claims its own width, and the
 * leftover arc is split into one identical gap between neighbours — so a wide
 * molar and a narrow incisor both sit with the same visual breathing room.
 * Both jaws share this layout (their type sequence is identical).
 */
const SLOTS = (() => {
  const widths = UPPER_ORDER.map((fdi) => TOOTH_SIZE[typeFromFdi(fdi)].width)
  const toothTotal = widths.reduce((sum, w) => sum + w, 0)
  const gap = (ARC_TABLE.total - toothTotal) / TEETH_PER_ROW

  const centers: number[] = []
  let cursor = gap / 2
  for (const width of widths) {
    centers.push(cursor + width / 2)
    cursor += width + gap
  }
  return { centers, gap }
})()

/**
 * Places one tooth on its jaw's half-ellipse.
 *
 * The point is the standard ellipse parametrisation
 *   x = cx + rx·cos θ,  y = cy + ry·sin θ
 * swept from `startAngle` to `endAngle` across the 16 slots of a row, so a
 * tooth sits at the centre of its slot.
 *
 * The rotation follows the ellipse's outward normal. For F(x,y) = (x/rx)² +
 * (y/ry)² the gradient at θ is (cos θ / rx, sin θ / ry), so the normal angle is
 * atan2(sin θ / ry, cos θ / rx). Shapes are drawn pointing "up", hence the +90°.
 *
 * The lower jaw mirrors the sweep vertically so its arc bulges downward, which
 * is what keeps the two rows facing each other across the midline gap.
 */
export function getToothTransform(
  meta: ToothMeta,
  layout: 'arch' | 'row' = 'arch',
): ToothTransform {
  const upper = isUpper(meta.fdi)

  if (layout === 'row') {
    const x = ROW.startX + meta.index * ROW.step + ROW.step / 2
    const y = upper ? ROW.upperY : ROW.lowerY
    return {
      x,
      y,
      angle: upper ? 0 : 180,
      labelX: x,
      labelY: upper ? y - ROW.numberOffset : y + ROW.numberOffset,
    }
  }

  const { cx, upperCy, lowerCy, radiusX, radiusY, numberOffset } = ARCH
  // Placed by distance along the curve, not by angle — see buildArcTable.
  const theta = thetaAtArcLength(SLOTS.centers[meta.index] ?? 0)

  const cosT = Math.cos(toRad(theta))
  const sinT = Math.sin(toRad(theta))

  const cy = upper ? upperCy : lowerCy
  // Upper jaw uses sin as-is (arc opens upward); the lower jaw flips it.
  const sinJaw = upper ? sinT : -sinT

  const x = cx + radiusX * cosT
  const y = cy + radiusY * sinJaw

  const normalDeg = (Math.atan2(sinJaw / radiusY, cosT / radiusX) * 180) / Math.PI
  const angle = normalDeg + 90

  // Labels ride the same ray, pushed further out, but stay upright.
  const labelX = cx + (radiusX + numberOffset) * cosT
  const labelY = cy + (radiusY + numberOffset) * sinJaw

  return { x, y, angle, labelX, labelY }
}

// ── Tooth ──

interface ToothProps {
  meta: ToothMeta
  transform: ToothTransform
  status?: ToothStatusDef
  statusId?: string
  selected: boolean
  disabled: boolean
  showNumber: boolean
  labels: DentalChartLabels
  /** Mount stagger order. */
  order: number
  /** `url(#…)` of this status's stripe pattern, when it has one. */
  hatchFill?: string
  onClick?: DentalChartProps['onToothClick']
  onHover?: DentalChartProps['onToothHover']
}

function Tooth({
  meta,
  transform,
  status,
  statusId,
  selected,
  disabled,
  showNumber,
  labels,
  order,
  hatchFill,
  onClick,
  onHover,
}: ToothProps) {
  const groupRef = useRef<SVGGElement>(null)
  const [hovered, setHovered] = useState(false)
  const isMotionDisabled = useMotionDisabled()
  const mountTransition = useTransition({ ...springs.control, delay: order * 0.015 })
  const pulseTransition = useTransition({ duration: 1.6, repeat: Infinity, ease: 'easeInOut' })
  const crownTransition = useTransition({ duration: 0.3, ease: 'easeOut' })

  const shape = SHAPES[meta.type]
  const size = TOOTH_SIZE[meta.type]

  const fillClassName = status?.fillClassName ?? 'fill-surface'
  const strokeClassName = status?.strokeClassName ?? 'stroke-border'
  const typeLabel = labels[meta.type]
  const statusLabel = status?.label

  const title = [`${labels.tooth} ${meta.fdi}`, typeLabel, statusLabel].filter(Boolean).join(' · ')

  function emitClick(event: MouseEvent | KeyboardEvent) {
    if (disabled || !groupRef.current) return
    onClick?.(meta.fdi, event, groupRef.current)
  }

  function handleKeyDown(event: KeyboardEvent<SVGGElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    emitClick(event)
  }

  const interactive = !disabled
  const scale = isMotionDisabled ? 1 : hovered && interactive ? 1.06 : 1

  return (
    <motion.g
      ref={groupRef}
      data-fdi={meta.fdi}
      data-status={statusId ?? 'none'}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={`${labels.tooth} ${meta.fdi}, ${typeLabel}${statusLabel ? `, ${statusLabel}` : ''}`}
      aria-disabled={disabled || undefined}
      className={cn(
        'outline-none [&:focus-visible_.tooth-focus]:opacity-100',
        interactive ? 'cursor-pointer' : 'cursor-default',
      )}
      style={{ transformOrigin: `${transform.x}px ${transform.y}px` }}
      initial={isMotionDisabled ? false : { opacity: 0, scale: 0.8 }}
      animate={{ opacity: disabled ? 0.45 : 1, scale }}
      transition={mountTransition}
      onMouseEnter={() => {
        if (interactive) {
          setHovered(true)
          onHover?.(meta.fdi)
        }
      }}
      onMouseLeave={() => {
        setHovered(false)
        onHover?.(null)
      }}
      onClick={emitClick}
      onKeyDown={handleKeyDown}
    >
      <title>{title}</title>

      <g transform={`translate(${transform.x} ${transform.y}) rotate(${transform.angle})`}>
        {/* Selection ring — soft pulse behind the crown. */}
        {selected && (
          <motion.ellipse
            animate={isMotionDisabled ? { opacity: 0.9 } : { opacity: [0.35, 1, 0.35] }}
            className="fill-none stroke-accent"
            rx={size.width / 2 + 3}
            ry={size.height / 2 + 3}
            strokeWidth={2}
            transition={pulseTransition}
          />
        )}

        {/* Focus ring, revealed by :focus-visible on the group. */}
        <ellipse
          className="tooth-focus pointer-events-none fill-none stroke-text opacity-0"
          rx={size.width / 2 + 2.5}
          ry={size.height / 2 + 2.5}
          strokeDasharray="3 2"
          strokeWidth={1.5}
        />

        {/* Crown. The key makes a status change remount the shape, which
            replays the colour transition plus a short pop. */}
        <motion.path
          animate={isMotionDisabled ? {} : { scale: [1, 1.12, 1] }}
          className={cn(fillClassName, strokeClassName)}
          d={shape.outline}
          initial={isMotionDisabled ? false : { scale: 1 }}
          key={statusId ?? 'none'}
          strokeLinejoin="round"
          strokeWidth={1.2}
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          transition={crownTransition}
        />

        {hatchFill === undefined ? null : (
          <path className="pointer-events-none" d={shape.outline} fill={hatchFill} />
        )}

        {/* Surface fissures — same stroke as the crown's own outline. */}
        <path
          className={cn('pointer-events-none fill-none opacity-55', strokeClassName)}
          d={shape.detail}
          strokeLinecap="round"
          strokeWidth={0.9}
        />

        {status?.marker === undefined ? null : (
          <g className="pointer-events-none" transform={`rotate(${-transform.angle})`}>
            <circle className={status.markerClassName} r={4.4} />
            <path
              className="fill-none stroke-surface"
              d={
                status.marker === 'check'
                  ? 'M -2 0 L -0.6 1.4 L 2.1 -1.4'
                  : 'M 0 -2.3 L 0 0 L 1.6 1'
              }
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.2}
            />
          </g>
        )}

        {/* Invisible hit area — guarantees a comfortable touch target. */}
        <rect
          className="fill-transparent"
          height={Math.max(size.height, MIN_HIT_SIZE)}
          width={Math.max(size.width, MIN_HIT_SIZE)}
          x={-Math.max(size.width, MIN_HIT_SIZE) / 2}
          y={-Math.max(size.height, MIN_HIT_SIZE) / 2}
        />
      </g>

      {/* FDI number — outside the arc and always upright. */}
      {showNumber && (
        <text
          className={cn(
            'pointer-events-none text-[9px] tabular-nums select-none',
            status?.numberClassName === undefined
              ? 'fill-text-tertiary'
              : cn(status.numberClassName, 'font-semibold'),
          )}
          dominantBaseline="middle"
          textAnchor="middle"
          x={transform.labelX}
          y={transform.labelY}
        >
          {meta.fdi}
        </text>
      )}
    </motion.g>
  )
}

// ── Chart ──

export function DentalChart({
  values = {},
  statuses,
  labels,
  layout = 'arch',
  selectedTeeth = [],
  disabledTeeth = [],
  hiddenTeeth = [],
  showNumbers = true,
  showQuadrantLines = true,
  showJawLabels = false,
  maxWidth = 440,
  onToothClick,
  onToothHover,
  className,
}: DentalChartProps) {
  const statusById = useMemo(() => new Map(statuses.map((s) => [s.id, s])), [statuses])
  // Pattern ids are document-global; two charts on one page must not share them.
  const patternPrefix = useId().replace(/:/g, '')
  const hatchedStatuses = statuses.filter((s) => s.hatched === true)

  const selected = useMemo(() => new Set(selectedTeeth), [selectedTeeth])
  const disabled = useMemo(() => new Set(disabledTeeth), [disabledTeeth])
  const hidden = useMemo(() => new Set(hiddenTeeth), [hiddenTeeth])

  const visibleTeeth = useMemo(() => TEETH.filter((meta) => !hidden.has(meta.fdi)), [hidden])

  const midX = layout === 'arch' ? ARCH.cx : ROW.startX + (TEETH_PER_ROW * ROW.step) / 2

  return (
    // biome-ignore lint/a11y/useSemanticElements: an SVG arch of teeth, not a form.
    <svg
      aria-label={`${labels.upper} / ${labels.lower}`}
      className={cn('mx-auto block h-auto w-full select-none', className)}
      role="group"
      style={maxWidth === 'none' ? undefined : { maxWidth }}
      viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
    >
      {hatchedStatuses.length === 0 ? null : (
        <defs>
          {hatchedStatuses.map((s) => (
            <pattern
              height={3.2}
              id={`${patternPrefix}-${s.id}`}
              key={s.id}
              patternTransform="rotate(45)"
              patternUnits="userSpaceOnUse"
              width={3.2}
            >
              <line className={s.strokeClassName} strokeWidth={1.1} x1={0} x2={0} y1={0} y2={3.2} />
            </pattern>
          ))}
        </defs>
      )}

      {showJawLabels && layout === 'arch' ? (
        <g className="pointer-events-none fill-text-tertiary text-[7px] tracking-wider uppercase select-none">
          <text textAnchor="middle" x={ARCH.cx} y={ARCH.upperCy - 14}>
            {labels.upper}
          </text>
          <text textAnchor="middle" x={ARCH.cx} y={ARCH.lowerCy + 18}>
            {labels.lower}
          </text>
        </g>
      ) : null}

      {/* Quadrant separators: vertical midline plus the inter-jaw line. */}
      {showQuadrantLines && (
        <g className="text-border-strong" strokeDasharray="3 4" strokeWidth={1}>
          <line stroke="currentColor" x1={midX} x2={midX} y1={8} y2={VIEWBOX.height - 8} />
          <line
            opacity={0.6}
            stroke="currentColor"
            x1={14}
            x2={VIEWBOX.width - 14}
            y1={VIEWBOX.height / 2}
            y2={VIEWBOX.height / 2}
          />
        </g>
      )}

      {visibleTeeth.map((meta, order) => {
        const statusId = values[meta.fdi]
        const status = statusId === undefined ? undefined : statusById.get(statusId)

        return (
          <Tooth
            disabled={disabled.has(meta.fdi)}
            key={meta.fdi}
            labels={labels}
            meta={meta}
            order={order}
            selected={selected.has(meta.fdi)}
            showNumber={showNumbers}
            transform={getToothTransform(meta, layout)}
            // `exactOptionalPropertyTypes` treats an explicit `undefined` as
            // different from an absent prop — spread rather than pass through.
            {...(onToothClick === undefined ? {} : { onClick: onToothClick })}
            {...(onToothHover === undefined ? {} : { onHover: onToothHover })}
            {...(status === undefined ? {} : { status })}
            {...(statusId === undefined ? {} : { statusId })}
            {...(status?.hatched === true
              ? { hatchFill: `url(#${patternPrefix}-${status.id})` }
              : {})}
          />
        )
      })}
    </svg>
  )
}
