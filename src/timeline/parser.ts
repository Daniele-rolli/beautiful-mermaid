import type { TimelineDiagram, TimelineDirection, TimelineSection } from './types.ts'

// ============================================================================
// Timeline parser
//
// Supported syntax (mermaid-compatible):
//   timeline [LR|TD]          — direction keyword; LR (left→right) is default
//   title <text>
//   section <name>            — optional grouping; periods after it belong here
//   {time period} : {event}   — period first, one or more colon-separated events
//   {time period} : {event} : {event}
//   : {event}                 — continuation line adds another event to the last period
// ============================================================================

export function parseTimelineDiagram(lines: string[]): TimelineDiagram {
  const diagram: TimelineDiagram = { direction: 'LR', sections: [] }
  let current: TimelineSection | null = null

  const ensureSection = (name = 'default'): TimelineSection => {
    const section: TimelineSection = { name, periods: [] }
    diagram.sections.push(section)
    current = section
    return section
  }

  for (const line of lines) {
    // Header
    if (/^timeline(?:\s|$)/i.test(line)) {
      const dir = line.match(/\bTD\b/i)
      if (dir) diagram.direction = 'TD' as TimelineDirection
      continue
    }

    // Title
    const titleMatch = line.match(/^title\s+(.+)$/)
    if (titleMatch) {
      diagram.title = titleMatch[1]!.trim()
      continue
    }

    // Section
    const sectionMatch = line.match(/^section\s+(.+)$/)
    if (sectionMatch) {
      ensureSection(sectionMatch[1]!.trim())
      continue
    }

    // Continuation event: ": {event}"
    if (line.startsWith(':')) {
      const section = current ?? ensureSection()
      const last = section.periods[section.periods.length - 1]
      if (!last) throw new Error('Timeline event continuation requires a preceding time period')
      last.events.push(line.slice(1).trim())
      continue
    }

    // Period with events: "{period} : {event}" or "{period} : {e1} : {e2}"
    const periodMatch = line.match(/^(.+?)\s*:\s*(.+)$/)
    if (periodMatch) {
      const section = current ?? ensureSection()
      const label = periodMatch[1]!.trim()
      const events = periodMatch[2]!.split(':').map(e => e.trim()).filter(Boolean)
      section.periods.push({ label, events })
      continue
    }

    throw new Error(`Invalid timeline line: "${line}"`)
  }

  // If no explicit sections were declared, collapse to a single default section
  if (diagram.sections.length === 0) {
    diagram.sections.push({ name: 'default', periods: [] })
  }

  return diagram
}
