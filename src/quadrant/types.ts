// ============================================================================
// Quadrant chart — type definitions
// ============================================================================

export interface QuadrantAxis {
  /** Label at the low end of the axis */
  low?: string
  /** Label at the high end of the axis */
  high?: string
  min: number
  max: number
}

export interface QuadrantPoint {
  label: string
  /** Normalized x in [0, 1] over xAxis.min..max */
  x: number
  /** Normalized y in [0, 1] over yAxis.min..max */
  y: number
}

export interface QuadrantChart {
  title?: string
  xAxis?: QuadrantAxis
  yAxis?: QuadrantAxis
  /** Labels for quadrants 1-4 (top-right, top-left, bottom-left, bottom-right) */
  quadrantLabels: [string, string, string, string]
  points: QuadrantPoint[]
}
