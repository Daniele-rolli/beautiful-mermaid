import type { TimelineDiagram } from './types.ts'
import type { PositionedTimeline } from './renderer.ts'
import type { RenderOptions } from '../types.ts'
import { estimateTextWidth, FONT_SIZES, FONT_WEIGHTS } from '../styles.ts'

// ============================================================================
// Timeline layout — direction-aware
//
// LR (default): each section is a horizontal band with a thin continuous
//     axis line. Periods are small dots ON the axis with floating labels
//     above; events hang below the axis as dots with labels to the right
//     of a single vertical spine. Bands stack.
// TD: sections top→down; within a section, periods flow top→bottom along a
//     vertical axis; events are listed to the right of each period.
//
// Canvas width always accounts for label widths so long labels never
// overflow (and thus never get clipped) — the diagram never "stretches".
// ============================================================================

const TIMELINE = {
  padding: 40,
  titleGap: 44,
  sectionGap: 60,
  sectionHeaderH: 24,
  periodGapX: 64,
  periodGapY: 20,
  /** Vertical gap between the section label and the axis line. */
  axisGap: 12,
  /** Vertical gap between the axis and the first event dot. */
  eventStartGap: 16,
  eventGapY: 22,
  /** Horizontal gap from an event dot to its label. */
  eventLabelGap: 8,
  /** Vertical gap from the axis up to a period label. */
  periodLabelGap: 12,
  periodDotR: 4.5,
  eventDotR: 3,
  bandBottomPad: 12,
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
      const centerX = TIMELINE.padding + 80
      let rowY = y0 + TIMELINE.sectionHeaderH
      let sectionWidth = textW(section.name) + TIMELINE.padding
      const periods = section.periods.map(period => {
        const py = rowY
        const rowH = Math.max(
          TIMELINE.eventStartGap + period.events.length * TIMELINE.eventGapY,
          TIMELINE.periodLabelGap * 2 + TIMELINE.eventDotR,
        )
        rowY += rowH + TIMELINE.periodGapY
        for (const ev of period.events) {
          sectionWidth = Math.max(sectionWidth, centerX + TIMELINE.eventLabelGap + 2 + textW(ev))
        }
        sectionWidth = Math.max(sectionWidth, centerX + TIMELINE.eventLabelGap + textW(period.label))
        return {
          label: period.label,
          x: centerX,
          y: py,
          width: TIMELINE.periodDotR * 2,
          height: TIMELINE.periodDotR * 2,
          centerX,
          events: period.events.map((ev, ei) => ({
            text: ev,
            x: centerX + TIMELINE.eventDotR + TIMELINE.eventLabelGap,
            y: py + TIMELINE.eventStartGap + ei * TIMELINE.eventGapY,
            width: textW(ev),
            height: 14,
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

  // LR: each section is a horizontal band — section label on top, a thin
  // axis line, period dots on the axis with floating labels above, and
  // events hanging below. Bands stack vertically.
  let y = TIMELINE.padding + titleH
  let maxWidth = 0
  const sections = diagram.sections.map((section, si) => {
    const y0 = y
    const axisY = y0 + TIMELINE.sectionHeaderH + TIMELINE.axisGap
    let x = TIMELINE.padding
    let maxEvents = 0
    let maxLabelRight: number = TIMELINE.padding
    const periods = section.periods.map(period => {
      const centerX = x + 40
      x += 80 + TIMELINE.periodGapX
      maxEvents = Math.max(maxEvents, period.events.length)
      // Period label floats above the axis, centered on the dot.
      const labelHalf = textW(period.label) / 2
      maxLabelRight = Math.max(maxLabelRight, centerX + labelHalf)
      const eventYs: number[] = []
      let ey = axisY + TIMELINE.eventStartGap
      period.events.forEach(ev => {
        eventYs.push(ey)
        maxLabelRight = Math.max(maxLabelRight, centerX + TIMELINE.eventDotR + TIMELINE.eventLabelGap + textW(ev))
        ey += TIMELINE.eventGapY
      })
      return {
        label: period.label,
        x: centerX,
        y: axisY,
        width: TIMELINE.periodDotR * 2,
        height: TIMELINE.periodDotR * 2,
        centerX,
        events: period.events.map((ev, ei) => ({
          text: ev,
          x: centerX + TIMELINE.eventDotR + TIMELINE.eventLabelGap,
          y: eventYs[ei]!,
          width: textW(ev),
          height: 14,
        })),
      }
    })
    const axisX1 = TIMELINE.padding
    const axisX2 = x - TIMELINE.periodGapX - 40
    const lastEventY = axisY + TIMELINE.eventStartGap + (maxEvents - 1) * TIMELINE.eventGapY
    const bandHeight = TIMELINE.sectionHeaderH + TIMELINE.axisGap + (lastEventY - axisY) + TIMELINE.bandBottomPad
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
