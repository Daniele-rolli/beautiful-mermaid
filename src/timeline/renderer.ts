import type { DiagramColors } from '../theme.ts'
import { svgOpenTag, buildStyleBlock } from '../theme.ts'
import { getSeriesColor, CHART_ACCENT_FALLBACK } from '../xychart/colors.ts'
import { escapeXml } from '../multiline-utils.ts'
import { TEXT_BASELINE_SHIFT, FONT_SIZES, FONT_WEIGHTS } from '../styles.ts'

// ============================================================================
// Timeline — SVG renderer
//
// Clean horizontal/vertical timeline matching the library's aesthetic.
// Each section gets a color from the accent palette; periods/events under
// a section share that color.
// ============================================================================

export interface PositionedTimelineEvent { text: string; x: number; y: number; width: number; height: number }
export interface PositionedTimelinePeriod { label: string; x: number; y: number; width: number; height: number; events: PositionedTimelineEvent[] }
export interface PositionedTimelineSection { name: string; colorIndex: number; x: number; y: number; width: number; height: number; periods: PositionedTimelinePeriod[] }
export interface PositionedTimeline {
  width: number
  height: number
  direction: 'LR' | 'TD'
  title?: { text: string; x: number; y: number }
  sections: PositionedTimelineSection[]
}

const r = (n: number): string => String(Math.round(n * 10) / 10)

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
    seriesRules.push(`  .timeline-event-color-${idx} { stroke: var(--timeline-color-${idx}); fill: none; }`)
  }

  parts.push(`<style>
  .timeline-period-box { stroke-width: 1.5; rx: 8; }
  .timeline-period-label { fill: var(--_text); }
  .timeline-event-label { fill: var(--_text-sec); }
  .timeline-event-line { stroke-width: 1.5; stroke-dasharray: 3 3; }
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
    // Section label
    parts.push(
      `<text x="${r(section.x)}" y="${r(section.y + 16)}" text-anchor="start" ` +
      `font-size="${FONT_SIZES.groupHeader}" font-weight="${FONT_WEIGHTS.groupHeader}" ` +
      `dy="${TEXT_BASELINE_SHIFT}" class="timeline-section-label">${escapeXml(section.name)}</text>`
    )

    for (const period of section.periods) {
      // Period box
      parts.push(
        `<rect x="${r(period.x)}" y="${r(period.y)}" width="${r(period.width)}" height="${r(period.height)}" ` +
        `class="timeline-period-box timeline-period-color-${section.colorIndex}"/>`
      )
      parts.push(
        `<text x="${r(period.x + period.width / 2)}" y="${r(period.y + period.height / 2)}" text-anchor="middle" ` +
        `font-size="${FONT_SIZES.nodeLabel}" font-weight="${FONT_WEIGHTS.nodeLabel}" ` +
        `dy="${TEXT_BASELINE_SHIFT}" class="timeline-period-label">${escapeXml(period.label)}</text>`
      )

      // Events
      for (const ev of period.events) {
        parts.push(
          `<line x1="${r(period.x + period.width / 2)}" y1="${r(period.y + period.height)}" ` +
          `x2="${r(period.x + period.width / 2)}" y2="${r(ev.y)}" class="timeline-event-line timeline-event-color-${section.colorIndex}"/>`
        )
        parts.push(
          `<text x="${r(ev.x)}" y="${r(ev.y)}" text-anchor="${positioned.direction === 'LR' ? 'middle' : 'start'}" ` +
          `font-size="${FONT_SIZES.edgeLabel}" font-weight="${FONT_WEIGHTS.edgeLabel}" ` +
          `dy="${TEXT_BASELINE_SHIFT}" class="timeline-event-label">${escapeXml(ev.text)}</text>`
        )
      }
    }
  }

  parts.push('</svg>')
  return parts.join('\n')
}
