import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DentalChart, TEETH } from './DentalChart'

const labels = {
  incisor: 'kesuvchi tish',
  canine: 'qoziq tish',
  premolar: 'kichik oziq tish',
  molar: 'katta oziq tish',
  upper: "Yuqori jag'",
  lower: "Pastki jag'",
  tooth: 'Tish',
}

const statuses = [
  { id: 'selected', fillClassName: 'fill-accent-soft', strokeClassName: 'stroke-accent' },
]

describe('DentalChart', () => {
  it('draws all 32 FDI teeth', () => {
    const { container } = render(<DentalChart labels={labels} statuses={statuses} />)

    expect(container.querySelectorAll('[data-fdi]')).toHaveLength(32)
    expect(TEETH).toHaveLength(32)
  })

  it('calls onToothClick with the FDI and the tooth element', async () => {
    const onToothClick = vi.fn()
    render(<DentalChart labels={labels} onToothClick={onToothClick} statuses={statuses} />)

    await userEvent.click(screen.getByRole('button', { name: /Tish 16/ }))

    expect(onToothClick).toHaveBeenCalledTimes(1)
    const [fdi, , element] = onToothClick.mock.calls[0] as [string, unknown, SVGGElement]
    expect(fdi).toBe('16')
    expect(element.tagName.toLowerCase()).toBe('g')
  })

  it('activates a tooth with the keyboard', async () => {
    const onToothClick = vi.fn()
    render(<DentalChart labels={labels} onToothClick={onToothClick} statuses={statuses} />)

    screen.getByRole('button', { name: /Tish 24/ }).focus()
    await userEvent.keyboard('{Enter}')

    expect(onToothClick).toHaveBeenCalledWith('24', expect.anything(), expect.anything())
  })

  it('does not fire for a disabled tooth', async () => {
    const onToothClick = vi.fn()
    render(
      <DentalChart
        disabledTeeth={['16']}
        labels={labels}
        onToothClick={onToothClick}
        statuses={statuses}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /Tish 16/ }))

    expect(onToothClick).not.toHaveBeenCalled()
  })

  it('marks a selected tooth, and nothing else, with the status class', () => {
    const { container } = render(
      <DentalChart labels={labels} statuses={statuses} values={{ '16': 'selected' }} />,
    )

    const selectedTooth = container.querySelector('[data-fdi="16"] path')
    const otherTooth = container.querySelector('[data-fdi="17"] path')

    expect(selectedTooth).toHaveClass('fill-accent-soft')
    expect(otherTooth).not.toHaveClass('fill-accent-soft')
  })

  it('hides teeth passed as hidden', () => {
    const { container } = render(
      <DentalChart hiddenTeeth={['18', '28', '38', '48']} labels={labels} statuses={statuses} />,
    )

    expect(container.querySelectorAll('[data-fdi]')).toHaveLength(28)
    expect(container.querySelector('[data-fdi="18"]')).not.toBeInTheDocument()
  })
})

describe('DentalChart status shapes', () => {
  const shaped = [
    {
      id: 'done',
      fillClassName: 'fill-success/30',
      strokeClassName: 'stroke-success',
      marker: 'check' as const,
      markerClassName: 'fill-success',
    },
    {
      id: 'inProgress',
      fillClassName: 'fill-warning/20',
      strokeClassName: 'stroke-warning',
      hatched: true,
      marker: 'clock' as const,
      markerClassName: 'fill-warning',
    },
  ]

  it('stripes a hatched status and badges both, so state does not rest on colour alone', () => {
    const { container } = render(
      <DentalChart
        labels={labels}
        statuses={shaped}
        values={{ '16': 'done', '24': 'inProgress' }}
      />,
    )

    const striped = container.querySelector('[data-fdi="24"] path[fill^="url(#"]')
    expect(striped).not.toBeNull()
    const patternId = striped?.getAttribute('fill')?.slice(5, -1) ?? ''
    expect(container.querySelector(`pattern[id="${patternId}"]`)).not.toBeNull()
    expect(container.querySelector('[data-fdi="16"] path[fill^="url(#"]')).toBeNull()
    expect(container.querySelector('[data-fdi="16"] circle.fill-success')).not.toBeNull()
    expect(container.querySelector('[data-fdi="24"] circle.fill-warning')).not.toBeNull()
    expect(container.querySelector('[data-fdi="11"] circle')).toBeNull()
  })

  it('writes the jaw names only when asked', () => {
    const { rerender } = render(<DentalChart labels={labels} statuses={shaped} />)
    expect(screen.queryByText("Yuqori jag'")).toBeNull()

    rerender(<DentalChart labels={labels} showJawLabels statuses={shaped} />)
    expect(screen.getByText("Yuqori jag'")).toBeInTheDocument()
    expect(screen.getByText("Pastki jag'")).toBeInTheDocument()
  })
})
