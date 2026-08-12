import type { PieChart, PieSlice } from './types.ts'

// ============================================================================
// Pie chart parser
//
// Supported syntax:
//   pie [showData]
//   title "Chart Title"
//   "Label" : value
// ============================================================================

export function parsePieDiagram(lines: string[]): PieChart {
  const chart: PieChart = { showData: false, slices: [] }

  for (const line of lines) {
    // Header: pie [showData] — may carry an inline title: pie title "Text"
    if (/^pie(?:\s|$)/i.test(line)) {
      if (/\bshowData\b/i.test(line)) chart.showData = true
      const rest = line.replace(/^pie\s*/i, '').trim()
      if (rest) {
        const inlineTitle = rest.match(/^title\s+"([^"]+)"$/)
        if (inlineTitle) {
          chart.title = inlineTitle[1]
        } else if (!/^showData\s*$/i.test(rest)) {
          throw new Error(`Invalid pie diagram line: "${line}"`)
        }
      }
      continue
    }

    // Title: title "Text"
    const titleMatch = line.match(/^title\s+"([^"]+)"\s*$/)
    if (titleMatch) {
      chart.title = titleMatch[1]
      continue
    }

    // Section: "Label" : value
    const sliceMatch = line.match(/^"([^"]+)"\s*:\s*(\d+(?:\.\d+)?)\s*$/)
    if (sliceMatch) {
      const slice: PieSlice = { label: sliceMatch[1]!, value: parseFloat(sliceMatch[2]!) }
      chart.slices.push(slice)
      continue
    }

    throw new Error(`Invalid pie diagram line: "${line}"`)
  }

  if (chart.slices.length === 0) {
    throw new Error('Pie diagram requires at least one section')
  }

  return chart
}
