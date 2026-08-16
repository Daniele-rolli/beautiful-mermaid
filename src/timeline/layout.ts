import type { TimelineDiagram } from './types.ts'
import type { PositionedTimeline } from './renderer.ts'
import type { RenderOptions } from '../types.ts'
import { estimateTextWidth, FONT_SIZES, FONT_WEIGHTS } from '../styles.ts'

// ============================================================================
// Timeline layout — direction-aware
//
// LR (default): each section is a horizontal band with a continuous timeline
//     axis running through the period boxes; events hang below the axis and
//     are labelled to the right of a single vertical spine. Bands stack.
// TD: sections top→down; within a section, periods flow top→bottom along a
//     vertical axis; events are listed to the right of each period.
//
// Canvas width always accounts for event label widths so long labels never
// overflow (and thus never get clipped) — the diagram never "stretches".
// ============================================================================

const TIMELINE = {
  padding: 40,
  titleGap: 44,
  sectionGap: 60,
  sectionHeaderH: 24,
  periodBoxW: 120,
  periodBoxH: 40,
  periodGapX: 60,
  periodGapY: 20,
  eventLabelGap: 10,
  eventGapY: 22,
  eventLabelH: 16,
  axisGap: 24,
} as const

const textW = (t: string): number => estimateTextWidth(t, FONT_SIZES.nodeLabel, FONT_WEIGHTS.nodeLabel)

export function layoutTimelineDiagram(diagram: TimelineDiagram, _options: RenderOptions = {}): PositionedTimeline {
  const hasTitle = !!diagram.title
  const titleH = hasTitle ? TIMELINE.titleGap : 0

  if (diagram.direction === 'TD') {
    let y = TIMELINE.padding + titleH
    let maxWidth = 0
    const sections = diagram.sections.map((section, si) => {
      const y0 = y
      const centerX = TIMELINE.padding + TIMELINE.periodBoxW / 2
      let rowY = y0 + TIMELINE.sectionHeaderH
      let sectionWidth = textW(section.name) + TIMELINE.padding
      const periods = section.periods.map(period => {
        const py = rowY
        const rowH = TIMELINE.periodBoxH + Math.max(0, period.events.length - 1) * TIMELINE.eventGapY
        rowY += rowH + TIMELINE.periodGapY
        for (const ev of period.events) {
          sectionWidth = Math.max(sectionWidth, TIMELINE.padding + TIMELINE.periodBoxW + TIMELINE.eventLabelGap + textW(ev))
        }
        return {
          label: period.label,
          x: TIMELINE.padding,
          y: py,
          width: TIMELINE.periodBoxW,
          height: TIMELINE.periodBoxH,
          centerX,
          events: period.events.map((ev, ei) => ({
            text: ev,
            x: TIMELINE.padding + TIMELINE.periodBoxW + TIMELINE.eventLabelGap,
            y: py + TIMELINE.periodBoxH / 2 + ei * TIMELINE.eventGapY,
            width: textW(ev),
            height: TIMELINE.eventLabelH,
          })),
        }
      })
      const sectionH = rowY - TIMELINE.periodGapY - y0
      const axisY1 = y0 + TIMELINE.sectionHeaderH
      const axisY2 = y0 + sectionH
      const width = sectionWidth + TIMELINE.padding
      maxWidth = Math.max(maxWidth, width)
      y = y0 + sectionH + TIMELINE.sectionGap
      return { name: section.name, colorIndex: si, x: TIMELINE.padding, y: y0, width, height: sectionH, axisX: centerX, axisY1, axisY2, periods }
    })
    return { width: maxWidth, height: y - TIMELINE.sectionGap, direction: 'TD', ...(diagram.title ? { title: { text: diagram.title, x: maxWidth / 2, y: TIMELINE.padding + 16 } } : {}), sections }
  }

  // LR: each section is a horizontal band — section label on top, a
  // continuous timeline axis through the period boxes, events hanging
  // below the axis. Bands stack vertically.
  let y = TIMELINE.padding + titleH
  let maxWidth = 0
  const sections = diagram.sections.map((section, si) => {
    const y0 = y
    const periodY = y0 + TIMELINE.sectionHeaderH
    const axisY = periodY + TIMELINE.periodBoxH / 2
    let x = TIMELINE.padding
    let maxEvents = 0
    let maxLabelRight: number = TIMELINE.padding
    const periods = section.periods.map(period => {
      const px = x
      const centerX = px + TIMELINE.periodBoxW / 2
      x += TIMELINE.periodBoxW + TIMELINE.periodGapX
      maxEvents = Math.max(maxEvents, period.events.length)
      const eventYs: number[] = []
      let ey = axisY + TIMELINE.periodBoxH / 2 + TIMELINE.axisGap
      period.events.forEach(ev => {
        eventYs.push(ey)
        maxLabelRight = Math.max(maxLabelRight, centerX + TIMELINE.eventLabelGap + textW(ev))
        ey += TIMELINE.eventGapY
      })
      return {
        label: period.label,
        x: px,
        y: periodY,
        width: TIMELINE.periodBoxW,
        height: TIMELINE.periodBoxH,
        centerX,
        events: period.events.map((ev, ei) => ({
          text: ev,
          x: centerX + TIMELINE.eventLabelGap,
          y: eventYs[ei]!,
          width: textW(ev),
          height: TIMELINE.eventLabelH,
        })),
      }
    })
    const axisX1 = TIMELINE.padding
    const axisX2 = x - TIMELINE.periodGapX
    const bandHeight = TIMELINE.sectionHeaderH + TIMELINE.periodBoxH + TIMELINE.axisGap + maxEvents * TIMELINE.eventGapY
    const contentWidth = Math.max(axisX2, maxLabelRight, textW(section.name) + TIMELINE.padding)
    const width = contentWidth + TIMELINE.padding
    maxWidth = Math.max(maxWidth, width)
    y += bandHeight + TIMELINE.sectionGap
    return { name: section.name, colorIndex: si, x: TIMELINE.padding, y: y0, width, height: bandHeight, axisX1, axisX2, axisY, periods }
  })

  const width = maxWidth
  const height = y - TIMELINE.sectionGap + TIMELINE.padding

  return { width, height, direction: 'LR', ...(diagram.title ? { title: { text: diagram.title, x: width / 2, y: TIMELINE.padding + 16 } } : {}), sections }
}
