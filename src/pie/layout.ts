import type { PieChart } from './types.ts'
import type { PositionedPie, PositionedPieSlice } from './renderer.ts'
import type { RenderOptions } from '../types.ts'
import { estimateTextWidth, FONT_SIZES, FONT_WEIGHTS } from '../styles.ts'

// ============================================================================
// Pie chart layout — donut geometry
//
// Slices start at -90° (12 o'clock) and sweep clockwise.
// Percent labels sit at the ring midline; legend sits on the right.
// ============================================================================

const PIE = {
  padding: 40,
  outerRadius: 140,
  innerRadius: 85,
  titleGap: 44,
  legendGap: 40,
  legendSwatch: 14,
  legendRowH: 26,
  legendLabelW: 180,
} as const

export function layoutPieDiagram(diagram: PieChart, _options: RenderOptions = {}): PositionedPie {
  const total = diagram.slices.reduce((sum, s) => sum + s.value, 0)
  if (total <= 0) throw new Error('Pie diagram values must sum to more than zero')

  const hasTitle = !!diagram.title
  const titleH = hasTitle ? PIE.titleGap : 0
  const diameter = PIE.outerRadius * 2

  const legendWidth = PIE.legendGap + PIE.legendLabelW + PIE.padding
  const width = PIE.padding + diameter + legendWidth
  const height = PIE.padding + titleH + diameter + PIE.padding

  const cx = PIE.padding + PIE.outerRadius
  const cy = PIE.padding + titleH + PIE.outerRadius

  const slices: PositionedPieSlice[] = []
  let angle = -Math.PI / 2
  diagram.slices.forEach((slice, i) => {
    const sweep = (slice.value / total) * Math.PI * 2
    const startAngle = angle
    const endAngle = angle + sweep
    slices.push({
      label: slice.label,
      value: slice.value,
      percent: slice.value / total,
      startAngle,
      endAngle,
      midAngle: (startAngle + endAngle) / 2,
      colorIndex: i,
    })
    angle = endAngle
  })

  const legend = slices.map((s, i) => ({
    label: s.label,
    percent: s.percent,
    x: PIE.padding + diameter + PIE.legendGap + PIE.legendSwatch + 8,
    y: cy + (i - slices.length / 2) * PIE.legendRowH,
    colorIndex: i,
  }))

  return {
    width,
    height,
    cx,
    cy,
    outerRadius: PIE.outerRadius,
    innerRadius: PIE.innerRadius,
    ...(diagram.title ? { title: { text: diagram.title, x: cx, y: PIE.padding + 20 } } : {}),
    slices,
    legend,
  }
}
