import { useMemo } from 'react'
import type { Workflow, WorkflowNode, WorkflowEdge, Agent } from '../types'

interface Props {
  workflow: Workflow
  agents?: Agent[]
}

const NODE_W = 160
const NODE_H = 56
const START_END_R = 28

function getNodeCenter(node: WorkflowNode) {
  if (node.type === 'start' || node.type === 'end') {
    return { cx: node.x + START_END_R, cy: node.y + START_END_R }
  }
  return { cx: node.x + NODE_W / 2, cy: node.y + NODE_H / 2 }
}

function getEdgePoints(src: WorkflowNode, tgt: WorkflowNode) {
  const s = getNodeCenter(src)
  const t = getNodeCenter(tgt)
  // exit right edge of source, enter left edge of target
  let x1 = s.cx, y1 = s.cy, x2 = t.cx, y2 = t.cy
  if (src.type === 'agent') x1 = src.x + NODE_W
  else x1 = src.x + START_END_R * 2
  if (tgt.type === 'agent') x2 = tgt.x
  else x2 = tgt.x
  const mx = (x1 + x2) / 2
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
}

function nodeById(nodes: WorkflowNode[], id: string) {
  return nodes.find(n => n.id === id)
}

export default function WorkflowDiagram({ workflow, agents = [] }: Props) {
  const agentMap = useMemo(() => {
    const m: Record<string, Agent> = {}
    agents.forEach(a => { m[a.id] = a })
    return m
  }, [agents])

  // Auto-calculate SVG viewbox
  const allX = workflow.nodes.map(n => n.x + (n.type === 'agent' ? NODE_W : START_END_R * 2))
  const allY = workflow.nodes.map(n => n.y + (n.type === 'agent' ? NODE_H : START_END_R * 2))
  const maxX = Math.max(...allX, 400) + 40
  const maxY = Math.max(...allY, 200) + 40

  if (workflow.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-slate-500 text-sm">
        No workflow nodes defined
      </div>
    )
  }

  return (
    <svg
      viewBox={`0 0 ${maxX} ${maxY}`}
      className="w-full"
      style={{ maxHeight: 260 }}
    >
      <defs>
        <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="rgba(124,58,237,0.7)" />
        </marker>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* Edges */}
      {workflow.edges.map((edge: WorkflowEdge) => {
        const src = nodeById(workflow.nodes, edge.source)
        const tgt = nodeById(workflow.nodes, edge.target)
        if (!src || !tgt) return null
        const path = getEdgePoints(src, tgt)
        const s = getNodeCenter(src)
        const t = getNodeCenter(tgt)
        const mx = (s.cx + t.cx) / 2
        const my = (s.cy + t.cy) / 2 - 8
        return (
          <g key={edge.id}>
            <path
              d={path}
              fill="none"
              stroke="rgba(124,58,237,0.35)"
              strokeWidth="1.5"
              markerEnd="url(#arrow)"
            />
            {edge.label && (
              <text x={mx} y={my} textAnchor="middle" fill="rgba(148,163,184,0.7)" fontSize="10">
                {edge.label}
              </text>
            )}
          </g>
        )
      })}

      {/* Nodes */}
      {workflow.nodes.map((node: WorkflowNode) => {
        if (node.type === 'start') {
          return (
            <g key={node.id}>
              <circle
                cx={node.x + START_END_R} cy={node.y + START_END_R} r={START_END_R}
                fill="rgba(16,185,129,0.15)" stroke="rgba(16,185,129,0.5)" strokeWidth="1.5"
                filter="url(#glow)"
              />
              <text x={node.x + START_END_R} y={node.y + START_END_R + 4}
                textAnchor="middle" fill="#10b981" fontSize="11" fontWeight="600">
                Start
              </text>
            </g>
          )
        }
        if (node.type === 'end') {
          return (
            <g key={node.id}>
              <circle
                cx={node.x + START_END_R} cy={node.y + START_END_R} r={START_END_R}
                fill="rgba(124,58,237,0.15)" stroke="rgba(124,58,237,0.5)" strokeWidth="1.5"
                filter="url(#glow)"
              />
              <text x={node.x + START_END_R} y={node.y + START_END_R + 4}
                textAnchor="middle" fill="#a78bfa" fontSize="11" fontWeight="600">
                End
              </text>
            </g>
          )
        }
        // agent node
        const agent = node.agent_id ? agentMap[node.agent_id] : null
        return (
          <g key={node.id}>
            <rect
              x={node.x} y={node.y} width={NODE_W} height={NODE_H} rx="10"
              fill="rgba(124,58,237,0.12)" stroke="rgba(124,58,237,0.35)" strokeWidth="1.5"
            />
            <text x={node.x + NODE_W / 2} y={node.y + 22}
              textAnchor="middle" fill="#e2e8f0" fontSize="11" fontWeight="600">
              {node.label}
            </text>
            {agent && (
              <text x={node.x + NODE_W / 2} y={node.y + 38}
                textAnchor="middle" fill="rgba(148,163,184,0.7)" fontSize="9">
                {agent.model}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
