import type { Mindmap, MindmapNode, MindmapShape } from './types.ts'
import type { PositionedMindmap, PositionedMindmapNode } from './renderer.ts'
import type { RenderOptions } from '../types.ts'
import type { ElkNode, ElkExtendedEdge } from 'elkjs'
import { elkLayoutSync } from '../elk-instance.ts'
import { measureMultilineText } from '../text-metrics.ts'
import { FONT_SIZES, FONT_WEIGHTS } from '../styles.ts'

// ============================================================================
// Mindmap layout — ELK tree algorithm
//
// Uses the ELK 'tree' layout (the same algorithm mermaid itself uses for
// mindmaps) via the existing elkLayoutSync() — synchronous, no new deps.
// Direction RIGHT = root left, children cascade right (mermaid default).
// ============================================================================

const MM = {
  padding: 40,
  titleGap: 44,
  nodeGapX: 60,
  nodeGapY: 24,
  nodePadX: 14,
  nodePadY: 8,
  nodeMinW: 40,
  nodeMinH: 32,
  shapeExtra: 20,
} as const

function sizeNode(node: MindmapNode): { width: number; height: number } {
  const metrics = measureMultilineText(node.text, FONT_SIZES.nodeLabel, FONT_WEIGHTS.nodeLabel)
  const width = Math.max(metrics.width + MM.nodePadX * 2, MM.nodeMinW) + (node.shape === 'circle' ? MM.shapeExtra : 0)
  const height = Math.max(metrics.height + MM.nodePadY * 2, MM.nodeMinH)
  return { width, height }
}

export function layoutMindmapDiagram(diagram: Mindmap, _options: RenderOptions = {}): PositionedMindmap {
  const hasTitle = !!diagram.title
  const titleH = hasTitle ? MM.titleGap : 0

  // 1. Convert the mindmap tree into an ELK graph.
  //    Flat node list keyed by path; edges connect each parent path to child path.
  const keyOf = (n: MindmapNode, path: number[]): string => path.join('/')

  interface FlatNode { node: MindmapNode; path: number[]; key: string }
  const flat: FlatNode[] = []
  const edges: Array<{ from: string; to: string }> = []
  const index = (node: MindmapNode, path: number[]): void => {
    const key = keyOf(node, path)
    flat.push({ node, path, key })
    node.children.forEach((child, i) => {
      edges.push({ from: key, to: keyOf(child, [...path, i]) })
      index(child, [...path, i])
    })
  }
  index(diagram.root, [0])

  const children: ElkNode[] = flat.map(f => {
    const { width, height } = sizeNode(f.node)
    return { id: f.key, width, height }
  })

  const elkEdges: ElkExtendedEdge[] = edges.map((e, i) => ({
    id: `e${i}`, sources: [e.from], targets: [e.to],
  }))

  const elkGraph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'org.eclipse.elk.mrtree',
      'elk.direction': 'RIGHT',
      'elk.padding': `[top=${MM.padding},left=${MM.padding},bottom=${MM.padding},right=${MM.padding}]`,
      'elk.spacing.nodeNode': String(MM.nodeGapY),
      'elk.tree.spacing.nodeNode': String(MM.nodeGapY),
      'elk.tree.spacing.nodeNodeBetweenLayers': String(MM.nodeGapX),
      'elk.edgeRouting': 'SPLINES',
    },
    children,
    edges: elkEdges,
  }

  // 2. Run ELK synchronously
  const result = elkLayoutSync(elkGraph)

  // 3. Read positions back: build a path → (x, y) map, then reconstruct the tree
  const posByKey = new Map<string, { x: number; y: number }>()
  for (const n of result.children ?? []) {
    posByKey.set(n.id, { x: n.x ?? 0, y: n.y ?? 0 })
  }

  // ELK's root node occupies the full canvas; subtract its x/y so the tree
  // starts at (padding, padding+titleH+rootH/2).
  const rootX = posByKey.get(keyOf(diagram.root, [0]))?.x ?? MM.padding
  const rootY = posByKey.get(keyOf(diagram.root, [0]))?.y ?? MM.padding

  const place = (node: MindmapNode, path: number[], depth: number): PositionedMindmapNode => {
    const key = keyOf(node, path)
    const pos = posByKey.get(key) ?? { x: 0, y: 0 }
    const { width, height } = sizeNode(node)
    const px = pos.x - rootX + MM.padding
    const py = pos.y - rootY + MM.padding + titleH + height / 2
    return {
      text: node.text,
      shape: node.shape,
      depth,
      x: px - width / 2,
      y: py,
      width,
      height,
      children: node.children.map((c, i) => place(c, [...path, i], depth + 1)),
    }
  }

  const root = place(diagram.root, [0], 0)

  // Compute overall bounds by walking the tree
  const canvas = result as { width?: number; height?: number }
  const width = canvas.width ?? (maxX(root) + MM.padding)
  const height = canvas.height ?? (maxY(root) - minY(root) + MM.padding * 2)

  return {
    width,
    height,
    ...(diagram.title ? { title: { text: diagram.title, x: width / 2, y: MM.padding + 16 } } : {}),
    root,
  }
}

function maxX(n: PositionedMindmapNode): number {
  return Math.max(n.x + n.width, ...n.children.map(maxX), MM.padding)
}
function minY(n: PositionedMindmapNode): number {
  return Math.min(n.y - n.height / 2, ...n.children.map(minY), 0)
}
function maxY(n: PositionedMindmapNode): number {
  return Math.max(n.y + n.height / 2, ...n.children.map(maxY), 0)
}
