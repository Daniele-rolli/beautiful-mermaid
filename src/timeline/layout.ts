import type { TimelineDiagram } from './types.ts'
import type { PositionedTimeline } from './renderer.ts'
import type { RenderOptions } from '../types.ts'
import { estimateTextWidth, FONT_SIZES, FONT_WEIGHTS } from '../styles.ts'

// ============================================================================
// Timeline layout — direction-aware
//
// LR: periods along a horizontal axis left→right; events stacked below each
//     period. Sections are header bands above their period runs.
// TD: sections top→down; periods left→right within a section; events below.
// ============================================================================

const TIMELINE = {
  padding: 40,
  titleGap: 44,
  sectionGap: 60,
  sectionHeaderH: 24,
  periodGap: 40,
  periodBoxW: 120,
  periodBoxH: 40,
  periodGapX: 60,
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
      y += TIMELINE.sectionHeaderH
      let x = TIMELINE.padding
      let sectionHeight = 0
      const periods = section.periods.map(period => {
        const px = x
        x += TIMELINE.periodBoxW + TIMELINE.periodGapX
        const eventYs: number[] = []
        let ey = y + TIMELINE.periodBoxH + TIMELINE.axisGap
        period.events.forEach(ev => {
          eventYs.push(ey)
          ey += TIMELINE.eventGapY
        })
        const ph = Math.max(TIMELINE.periodBoxH + TIMELINE.axisGap + eventYs.length * TIMELINE.eventGapY, TIMELINE.periodBoxH + 8)
        sectionHeight = Math.max(sectionHeight, ph)
        return {
          label: period.label,
          x: px,
          y,
          width: TIMELINE.periodBoxW,
          height: TIMELINE.periodBoxH,
          events: period.events.map((ev, ei) => ({
            text: ev,
            x: px + TIMELINE.periodBoxW + 12,
            y: eventYs[ei]!,
            width: textW(ev),
            height: TIMELINE.eventLabelH,
          })),
        }
      })
      maxWidth = Math.max(maxWidth, x - TIMELINE.periodGapX + TIMELINE.padding)
      const sectionObj = { name: section.name, colorIndex: si, x: TIMELINE.padding, y: y0, width: 0, height: 0, periods }
      y += sectionHeight
      y += TIMELINE.sectionGap
      return sectionObj
    })
    return { width: maxWidth, height: y - TIMELINE.sectionGap, direction: 'TD', ...(diagram.title ? { title: { text: diagram.title, x: maxWidth / 2, y: TIMELINE.padding + 16 } } : {}), sections }
  }

  // LR: each section is a horizontal band — section label on top,
  // periods laid left→right, events below. Bands stack vertically.
  let y = TIMELINE.padding + titleH
  let maxWidth = 0
  const sections = diagram.sections.map((section, si) => {
    const y0 = y
    const periodY = y0 + TIMELINE.sectionHeaderH
    let x = TIMELINE.padding
    let maxEvents = 0
    const periods = section.periods.map(period => {
      const px = x
      x += TIMELINE.periodBoxW + TIMELINE.periodGapX
      maxEvents = Math.max(maxEvents, period.events.length)
      const eventYs: number[] = []
      let ey = periodY + TIMELINE.periodBoxH + TIMELINE.axisGap
      period.events.forEach(ev => {
        eventYs.push(ey)
        ey += TIMELINE.eventGapY
      })
      return {
        label: period.label,
        x: px,
        y: periodY,
        width: TIMELINE.periodBoxW,
        height: TIMELINE.periodBoxH,
        events: period.events.map((ev, ei) => ({
          text: ev,
          x: px + TIMELINE.periodBoxW / 2,
          y: eventYs[ei]!,
          width: textW(ev),
          height: TIMELINE.eventLabelH,
        })),
      }
    })
    const bandHeight = TIMELINE.sectionHeaderH + TIMELINE.axisGap + TIMELINE.periodBoxH + TIMELINE.axisGap + maxEvents * TIMELINE.eventGapY
    const width = Math.max(...periods.map(p => p.x + TIMELINE.periodBoxW), TIMELINE.padding)
    maxWidth = Math.max(maxWidth, width)
    y += bandHeight + TIMELINE.sectionGap
    return { name: section.name, colorIndex: si, x: TIMELINE.padding, y: y0, width, height: bandHeight, periods }
  })

  const width = maxWidth
  const height = y - TIMELINE.sectionGap + TIMELINE.padding

  return { width, height, direction: 'LR', ...(diagram.title ? { title: { text: diagram.title, x: width / 2, y: TIMELINE.padding + 16 } } : {}), sections }
}
