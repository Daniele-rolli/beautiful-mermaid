import type { PieChart } from './types.ts'
import type { DiagramColors } from '../theme.ts'
import { svgOpenTag, buildStyleBlock } from '../theme.ts'
import { getSeriesColor, CHART_ACCENT_FALLBACK } from '../xychart/colors.ts'
import { escapeXml } from '../multiline-utils.ts'
import { TEXT_BASELINE_SHIFT, FONT_SIZES, FONT_WEIGHTS } from '../styles.ts'

// ============================================================================
// Pie chart — SVG renderer
//
// Visual style: clean donut, matching the library's Apple/Craft aesthetic.
//   - Donut (annular) slices, gap-free
//   - Percent labels at the ring midline, centered on each slice
//   - Legend on the right with color swatches
//   - showData adds value text next to each legend percent
// ============================================================================

export interface PositionedPieSlice {
  label: string
  value: number
  percent: number
  startAngle: number
  endAngle: number
  midAngle: number
  colorIndex: number
}

export interface PositionedPie {
  width: number
  height: number
  cx: number
  cy: number
  outerRadius: number
  innerRadius: number
  title?: { text: string; x: number; y: number }
  slices: PositionedPieSlice[]
  legend: Array<{ label: string; percent: number; x: number; y: number; colorIndex: number }>
}

const r = (n: number): string => String(Math.round(n * 10) / 10)

const fmtPct = (p: number): string => `${Math.round(p * 100)}%`

function polar(cx: number, cy: number, radius: number, angle: number): { x: number; y: number } {
  return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) }
}

/** Annular (donut) slice path from startAngle to endAngle (radians, clockwise from top). */
function donutSlicePath(cx: number, cy: number, outerR: number, innerR: number, a0: number, a1: number): string {
  const o0 = polar(cx, cy, outerR, a0)
  const o1 = polar(cx, cy, outerR, a1)
  const i0 = polar(cx, cy, innerR, a0)
  const i1 = polar(cx, cy, innerR, a1)
  const large = a1 - a0 > Math.PI ? 1 : 0
  return [
    `M${r(o0.x)},${r(o0.y)}`,
    `A${r(outerR)},${r(outerR)} 0 ${large} 1 ${r(o1.x)},${r(o1.y)}`,
    `L${r(i1.x)},${r(i1.y)}`,
    `A${r(innerR)},${r(innerR)} 0 ${large} 0 ${r(i0.x)},${r(i0.y)}`,
    'Z',
  ].join(' ')
}

export function renderPieSvg(
  positioned: PositionedPie,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
): string {
  const { width, height, cx, cy, outerRadius, innerRadius } = positioned
  const parts: string[] = []

  const maxColorIdx = Math.max(0, ...positioned.slices.map(s => s.colorIndex))
  const svgTag = svgOpenTag(width, height, colors, transparent)
    .replace('<svg ', `<svg data-pie-colors="${maxColorIdx}" `)
  parts.push(svgTag)
  parts.push(buildStyleBlock(font, false))

  // Slice color CSS vars + rules (mirrors xychart chartStyles pattern)
  const accentHex = colors.accent ?? CHART_ACCENT_FALLBACK
  const bgHex = colors.bg
  const colorVarDefs: string[] = []
  const seriesRules: string[] = []
  for (let idx = 0; idx <= maxColorIdx; idx++) {
    const value = idx === 0
      ? `var(--accent, ${CHART_ACCENT_FALLBACK})`
      : getSeriesColor(idx, accentHex, bgHex)
    colorVarDefs.push(`    --pie-color-${idx}: ${value};`)
    seriesRules.push(`  path.pie-slice.pie-color-${idx} { fill: var(--pie-color-${idx}); }`)
    seriesRules.push(`  rect.pie-swatch.pie-color-${idx} { fill: var(--pie-color-${idx}); }`)
  }

  parts.push(`<style>
  .pie-slice { stroke: var(--bg); stroke-width: 2; }
  .pie-label { fill: var(--_text-sec); }
  .pie-value { fill: var(--_text-muted); }
  .pie-legend-label { fill: var(--_text); }
  .pie-legend-value { fill: var(--_text-muted); }
  .pie-legend-swatch { stroke: color-mix(in srgb, var(--fg) 12%, var(--bg)); }
  .pie-title { fill: var(--_text); }
  svg {
${colorVarDefs.join('\n')}
  }
${seriesRules.join('\n')}
</style>`)

  if (positioned.title) {
    parts.push(
      `<text x="${r(positioned.title.x)}" y="${r(positioned.title.y)}" text-anchor="middle" ` +
      `font-size="18" font-weight="600" dy="${TEXT_BASELINE_SHIFT}" class="pie-title">${escapeXml(positioned.title.text)}</text>`
    )
  }

  // Slices + percent labels
  for (const s of positioned.slices) {
    const d = donutSlicePath(cx, cy, outerRadius, innerRadius, s.startAngle, s.endAngle)
    parts.push(`<path d="${d}" class="pie-slice pie-color-${s.colorIndex}" data-value="${s.value}"/>`)

    const midR = (outerRadius + innerRadius) / 2
    const lp = polar(cx, cy, midR, s.midAngle)
    parts.push(
      `<text x="${r(lp.x)}" y="${r(lp.y)}" text-anchor="middle" ` +
      `font-size="${FONT_SIZES.nodeLabel}" font-weight="${FONT_WEIGHTS.nodeLabel}" ` +
      `dy="${TEXT_BASELINE_SHIFT}" class="pie-label">${escapeXml(fmtPct(s.percent))}</text>`
    )
  }

  // Legend
  for (const item of positioned.legend) {
    parts.push(
      `<rect x="${r(item.x - 22)}" y="${r(item.y - 9)}" width="14" height="14" rx="3" ` +
      `class="pie-swatch pie-color-${item.colorIndex}"/>`
    )
    parts.push(
      `<text x="${r(item.x)}" y="${r(item.y)}" text-anchor="start" ` +
      `font-size="${FONT_SIZES.edgeLabel}" font-weight="${FONT_WEIGHTS.edgeLabel}" ` +
      `dy="${TEXT_BASELINE_SHIFT}" class="pie-legend-label">${escapeXml(item.label)}</text>`
    )
    parts.push(
      `<text x="${r(item.x)}" y="${r(item.y + 15)}" text-anchor="start" ` +
      `font-size="${FONT_SIZES.edgeLabel}" font-weight="400" dy="${TEXT_BASELINE_SHIFT}" class="pie-legend-value">${escapeXml(fmtPct(item.percent))}</text>`
    )
  }

  parts.push('</svg>')
  return parts.join('\n')
}
