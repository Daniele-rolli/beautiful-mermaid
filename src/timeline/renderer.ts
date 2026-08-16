import type { DiagramColors } from '../theme.ts'
import { svgOpenTag, buildStyleBlock } from '../theme.ts'
import { getSeriesColor, CHART_ACCENT_FALLBACK } from '../xychart/colors.ts'
import { escapeXml } from '../multiline-utils.ts'
import { TEXT_BASELINE_SHIFT, FONT_SIZES, FONT_WEIGHTS } from '../styles.ts'

// ============================================================================
// Timeline — SVG renderer
//
// A real timeline: a continuous axis line runs through the period boxes,
// each period gets a dot on the axis, and events hang below the axis —
// a single vertical spine per period with short horizontal ticks into
// right-anchored labels (so labels never overlap their spine).
//
// Each section gets a color from the accent palette; periods/events under
// a section share that color.
// ============================================================================

export interface PositionedTimelineEvent { text: string; x: number; y: number; width: number; height: number }
export interface PositionedTimelinePeriod {
  label: string
  x: number
  y: number
  width: number
  height: number
  /** Horizontal center of the period box — the axis/dot/spine column. */
  centerX: number
  events: PositionedTimelineEvent[]
}
export interface PositionedTimelineSection {
  name: string
  colorIndex: number
  x: number
  y: number
  width: number
  height: number
  /** LR: horizontal axis through the period boxes. */
  axisX1?: number
  axisX2?: number
  axisY?: number
  /** TD: vertical axis through the period rows. */
  axisX?: number
  axisY1?: number
  axisY2?: number
  periods: PositionedTimelinePeriod[]
}
export interface PositionedTimeline {
  width: number
  height: number
  direction: 'LR' | 'TD'
  title?: { text: string; x: number; y: number }
  sections: PositionedTimelineSection[]
}

const r = (n: number): string => String(Math.round(n * 10) / 10)

const AXIS_DOT_R = 4

export function renderTimelineSvg(
  positioned: PositionedTimeline,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
): string {
  const { width, height } = positioned
  const parts: string[] = []

  const maxColorIdx = Math.max(0, ...positioned.sections.map(s => s.colorIndex))
  const svgTag = svgOpenTag(width, height, colors, transparent)
    .replace('<svg ', `<svg data-timeline-colors="${maxColorIdx}" `)
  parts.push(svgTag)
  parts.push(buildStyleBlock(font, false))

  const accentHex = colors.accent ?? CHART_ACCENT_FALLBACK
  const bgHex = colors.bg
  const colorVarDefs: string[] = []
  const seriesRules: string[] = []
  for (let idx = 0; idx <= maxColorIdx; idx++) {
    const value = idx === 0
      ? `var(--accent, ${CHART_ACCENT_FALLBACK})`
      : getSeriesColor(idx, accentHex, bgHex)
    colorVarDefs.push(`    --timeline-color-${idx}: ${value};`)
    seriesRules.push(`  .timeline-period-color-${idx} { fill: color-mix(in srgb, var(--bg) 82%, var(--timeline-color-${idx}) 18%); stroke: var(--timeline-color-${idx}); }`)
    seriesRules.push(`  .timeline-axis-color-${idx} { stroke: var(--timeline-color-${idx}); }`)
    seriesRules.push(`  .timeline-dot-color-${idx} { fill: var(--timeline-color-${idx}); stroke: var(--bg); }`)
    seriesRules.push(`  .timeline-spine-color-${idx} { stroke: var(--timeline-color-${idx}); fill: none; }`)
  }

  parts.push(`<style>
  .timeline-axis { stroke-width: 2; }
  .timeline-axis-dot { stroke-width: 2; }
  .timeline-period-box { stroke-width: 1.5; rx: 8; }
  .timeline-period-label { fill: var(--_text); }
  .timeline-event-label { fill: var(--_text-sec); }
  .timeline-event-tick { stroke-width: 1.5; }
  .timeline-section-label { fill: var(--_text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
  .timeline-title { fill: var(--_text); }
  svg {
${colorVarDefs.join('\n')}
  }
${seriesRules.join('\n')}
</style>`)

  if (positioned.title) {
    parts.push(
      `<text x="${r(positioned.title.x)}" y="${r(positioned.title.y)}" text-anchor="middle" ` +
      `font-size="18" font-weight="600" dy="${TEXT_BASELINE_SHIFT}" class="timeline-title">${escapeXml(positioned.title.text)}</text>`
    )
  }

  for (const section of positioned.sections) {
    parts.push(
      `<text x="${r(section.x)}" y="${r(section.y + 16)}" text-anchor="start" ` +
      `font-size="${FONT_SIZES.groupHeader}" font-weight="${FONT_WEIGHTS.groupHeader}" ` +
      `dy="${TEXT_BASELINE_SHIFT}" class="timeline-section-label">${escapeXml(section.name)}</text>`
    )

    // Continuous timeline axis
    if (section.axisX1 !== undefined && section.axisX2 !== undefined && section.axisY !== undefined) {
      parts.push(
        `<line x1="${r(section.axisX1)}" y1="${r(section.axisY)}" x2="${r(section.axisX2)}" y2="${r(section.axisY)}" ` +
        `class="timeline-axis timeline-axis-color-${section.colorIndex}"/>`
      )
    }
    if (section.axisX !== undefined && section.axisY1 !== undefined && section.axisY2 !== undefined) {
      parts.push(
        `<line x1="${r(section.axisX)}" y1="${r(section.axisY1)}" x2="${r(section.axisX)}" y2="${r(section.axisY2)}" ` +
        `class="timeline-axis timeline-axis-color-${section.colorIndex}"/>`
      )
    }

    for (const period of section.periods) {
      parts.push(
        `<rect x="${r(period.x)}" y="${r(period.y)}" width="${r(period.width)}" height="${r(period.height)}" ` +
        `class="timeline-period-box timeline-period-color-${section.colorIndex}"/>`
      )
      parts.push(
        `<text x="${r(period.x + period.width / 2)}" y="${r(period.y + period.height / 2)}" text-anchor="middle" ` +
        `font-size="${FONT_SIZES.nodeLabel}" font-weight="${FONT_WEIGHTS.nodeLabel}" ` +
        `dy="${TEXT_BASELINE_SHIFT}" class="timeline-period-label">${escapeXml(period.label)}</text>`
      )

      // Dot on the axis at this period's center
      if (section.axisY !== undefined) {
        parts.push(
          `<circle cx="${r(period.centerX)}" cy="${r(section.axisY)}" r="${AXIS_DOT_R}" ` +
          `class="timeline-axis-dot timeline-dot-color-${section.colorIndex}"/>`
        )
      }
      if (section.axisX !== undefined) {
        parts.push(
          `<circle cx="${r(section.axisX)}" cy="${r(period.y + period.height / 2)}" r="${AXIS_DOT_R}" ` +
          `class="timeline-axis-dot timeline-dot-color-${section.colorIndex}"/>`
        )
      }

      // Events: one vertical spine down from the box, then a horizontal
      // tick into each right-anchored label.
      if (period.events.length > 0) {
        const lastEventY = period.events[period.events.length - 1]!.y
        const spineClass = `timeline-spine-color-${section.colorIndex}`
        if (positioned.direction === 'LR') {
          parts.push(
            `<line x1="${r(period.centerX)}" y1="${r(period.y + period.height)}" ` +
            `x2="${r(period.centerX)}" y2="${r(lastEventY)}" class="${spineClass}"/>`
          )
        } else {
          parts.push(
            `<line x1="${r(period.x + period.width)}" y1="${r(period.y + period.height / 2)}" ` +
            `x2="${r(period.x + period.width + 14)}" y2="${r(period.y + period.height / 2)}" ` +
            `class="${spineClass}"/>`
          )
        }

        for (const ev of period.events) {
          // Horizontal tick from the spine column to the label
          const tickFrom = positioned.direction === 'LR' ? period.centerX : period.x + period.width + 14
          parts.push(
            `<line x1="${r(tickFrom)}" y1="${r(ev.y)}" x2="${r(ev.x - 6)}" y2="${r(ev.y)}" ` +
            `class="timeline-event-tick ${spineClass}"/>`
          )
          parts.push(
            `<text x="${r(ev.x)}" y="${r(ev.y)}" text-anchor="start" ` +
            `font-size="${FONT_SIZES.edgeLabel}" font-weight="${FONT_WEIGHTS.edgeLabel}" ` +
            `dy="${TEXT_BASELINE_SHIFT}" class="timeline-event-label">${escapeXml(ev.text)}</text>`
          )
        }
      }
    }
  }

  parts.push('</svg>')
  return parts.join('\n')
}
