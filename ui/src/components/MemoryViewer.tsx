import { useState } from 'react'
import { Brain, ChevronDown, ChevronRight, Clock, User } from 'lucide-react'
import type { MemoryFile } from '../types'

interface Props {
  memories: MemoryFile[]
  emptyMessage?: string
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`
}

/** Renders markdown-like content: headings, bold, code blocks, bullet lists */
function MarkdownContent({ content }: { content: string }) {
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let codeBlock: string[] = []
  let inCode = false
  let key = 0

  const renderInline = (text: string) => {
    // Bold **...**
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/)
    return parts.map((p, i) => {
      if (p.startsWith('**') && p.endsWith('**'))
        return <strong key={i} className="text-white font-semibold">{p.slice(2, -2)}</strong>
      if (p.startsWith('`') && p.endsWith('`'))
        return <code key={i} className="font-mono text-[11px] bg-white/8 px-1 py-0.5 rounded text-violet-300">{p.slice(1, -1)}</code>
      return p
    })
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.startsWith('```')) {
      if (!inCode) { inCode = true; codeBlock = []; continue }
      elements.push(
        <pre key={key++} className="my-2 p-3 bg-black/30 border border-white/8 rounded-lg text-[11px] font-mono text-slate-300 overflow-x-auto leading-relaxed whitespace-pre-wrap">
          {codeBlock.join('\n')}
        </pre>
      )
      inCode = false; codeBlock = []
      continue
    }
    if (inCode) { codeBlock.push(line); continue }

    if (line.startsWith('### '))
      elements.push(<h3 key={key++} className="text-xs font-bold text-slate-200 mt-3 mb-1">{line.slice(4)}</h3>)
    else if (line.startsWith('## '))
      elements.push(<h2 key={key++} className="text-sm font-bold text-white mt-4 mb-1.5 pb-1 border-b border-white/8">{line.slice(3)}</h2>)
    else if (line.startsWith('# '))
      elements.push(<h1 key={key++} className="text-base font-bold text-white mt-2 mb-2">{line.slice(2)}</h1>)
    else if (line.startsWith('- ') || line.startsWith('* '))
      elements.push(<li key={key++} className="text-xs text-slate-400 ml-3 list-disc list-inside leading-relaxed">{renderInline(line.slice(2))}</li>)
    else if (/^\d+\. /.test(line))
      elements.push(<li key={key++} className="text-xs text-slate-400 ml-3 list-decimal list-inside leading-relaxed">{renderInline(line.replace(/^\d+\. /, ''))}</li>)
    else if (line.trim() === '')
      elements.push(<div key={key++} className="h-1.5" />)
    else
      elements.push(<p key={key++} className="text-xs text-slate-400 leading-relaxed">{renderInline(line)}</p>)
  }

  return <div className="space-y-0.5">{elements}</div>
}

export default function MemoryViewer({ memories, emptyMessage = 'No memory files yet.' }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggle(id: string) {
    setExpanded(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  if (memories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Brain size={28} className="text-slate-700 mb-2" />
        <p className="text-xs text-slate-600">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {memories.map(m => {
        const open = expanded.has(m.id)
        return (
          <div
            key={m.id}
            className="rounded-xl border border-white/8 overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.03)' }}
          >
            <button
              onClick={() => toggle(m.id)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/4 transition-colors"
            >
              <Brain size={14} className="text-violet-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-200 truncate">{m.title}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  {m.written_by && (
                    <span className="flex items-center gap-1 text-[10px] text-slate-600">
                      <User size={9} />{m.written_by}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-[10px] text-slate-600">
                    <Clock size={9} />{timeAgo(m.updated_at)}
                  </span>
                </div>
              </div>
              {open
                ? <ChevronDown size={13} className="text-slate-500 flex-shrink-0" />
                : <ChevronRight size={13} className="text-slate-600 flex-shrink-0" />}
            </button>
            {open && (
              <div className="px-4 pb-4 border-t border-white/5">
                <div className="mt-3">
                  <MarkdownContent content={m.content} />
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
