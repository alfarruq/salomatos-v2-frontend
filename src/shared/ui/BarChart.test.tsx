import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BarChart } from './BarChart'

function columnHeights(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[style]')).map((el) => el.style.height)
}

describe('BarChart', () => {
  it('keeps a part larger than its whole inside the bar', () => {
    const { container } = render(
      <BarChart
        data={[{ key: 'a', label: 'A', value: 10, part: 40 }]}
        label="Chart"
        partLabel="Part"
        valueLabel="All"
      />,
    )
    expect(columnHeights(container)).toEqual(['100%', '100%'])
  })

  it('scales paired series to the larger one so neither disappears', () => {
    const { container } = render(
      <BarChart
        data={[{ key: 'a', label: 'A', value: 10, part: 40 }]}
        label="Chart"
        paired
        partLabel="Collected"
        valueLabel="Billed"
      />,
    )
    expect(columnHeights(container)).toEqual(['25%', '100%'])
  })
})
