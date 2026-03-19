'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Copy, Check, ChevronRight, Loader2, Download, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils/cn'
import { SECTION_HEADERS, type SectionHeader } from '@/lib/ai/prompts'

interface Props {
  buildId: string
  initialPrompt: string
  initialOutput: string
  initialStatus: string
}

interface CodeBlock {
  filename: string
  language: string
  code: string
}

function extractSections(text: string): Partial<Record<SectionHeader, string>> {
  const result: Partial<Record<SectionHeader, string>> = {}
  for (let i = 0; i < SECTION_HEADERS.length; i++) {
    const header = SECTION_HEADERS[i]
    const pattern = new RegExp(`## \\d+\\.\\s+${header}\\n([\\s\\S]*?)(?=## \\d+\\.|$)`, 'i')
    const match = text.match(pattern)
    if (match) result[header] = match[1].trim()
  }
  return result
}

function extractCodeBlocks(content: string): CodeBlock[] {
  const blocks: CodeBlock[] = []
  const regex = /```(\w+)(?:\s+filename="([^"]+)")?\n([\s\S]*?)```/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    blocks.push({
      language: match[1],
      filename: match[2] ?? `snippet.${match[1]}`,
      code: match[3].trim(),
    })
  }
  return blocks
}

function stripCodeBlocks(content: string): string {
  return content.replace(/```[\s\S]*?```/g, '').trim()
}

function renderMarkdown(text: string): string {
  return text
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^([^<\n].+)$/gm, '<p>$1</p>')
    .replace(/(<li>[\s\S]+?<\/li>)/g, '<ul>$1</ul>')
    .replace(/<\/ul>\s*<ul>/g, '')
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text transition-colors">
      {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

function CodeViewer({ blocks }: { blocks: CodeBlock[] }) {
  const [active, setActive] = useState(0)
  if (blocks.length === 0) return null
  const current = blocks[active]

  return (
    <div className="bg-[#0A0A10] border border-border rounded-xl overflow-hidden">
      {/* File tabs */}
      <div className="flex items-center gap-0 border-b border-border overflow-x-auto scrollbar-none">
        {blocks.map((b, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={cn(
              'flex items-center gap-2 px-3 py-2.5 text-xs font-mono shrink-0 border-r border-border transition-colors',
              i === active
                ? 'bg-surface text-text'
                : 'text-text-muted hover:text-text-soft bg-transparent'
            )}
          >
            <FileIcon lang={b.language} />
            <span className="truncate max-w-[160px]">{b.filename}</span>
          </button>
        ))}
      </div>

      {/* Code content */}
      <div className="relative">
        <div className="absolute top-3 right-3 z-10">
          <CopyButton text={current?.code ?? ''} />
        </div>
        <pre className="overflow-x-auto p-5 text-xs leading-relaxed font-mono text-text/85 max-h-[600px] overflow-y-auto">
          <code>{current?.code}</code>
        </pre>
      </div>
    </div>
  )
}

function FileIcon({ lang }: { lang: string }) {
  const colors: Record<string, string> = {
    typescript: 'text-blue-400', tsx: 'text-blue-400',
    javascript: 'text-yellow-400', jsx: 'text-yellow-400',
    css: 'text-pink-400', html: 'text-orange-400',
    sql: 'text-emerald-400', json: 'text-amber-400',
  }
  return <span className={cn('text-xs', colors[lang] ?? 'text-text-muted')}>●</span>
}

const SECTION_LABELS: Partial<Record<SectionHeader, string>> = {
  'PRODUCT INTERPRETATION': 'Product',
  'STRATEGIC UPGRADE': 'Strategy',
  'CORE FEATURES': 'Features',
  'USER FLOW': 'User Flow',
  'TECH STACK': 'Stack',
  'SYSTEM ARCHITECTURE': 'Architecture',
  'DESIGN DIRECTION': 'Design',
  'BUILD': 'Code',
  'DEPLOYMENT NOTES': 'Deploy',
  'V2 RECOMMENDATIONS': 'V2',
}

export default function BuildResultClient({
  buildId, initialPrompt, initialOutput, initialStatus,
}: Props) {
  const [output, setOutput] = useState(initialOutput)
  const [status, setStatus] = useState(initialStatus)
  const [activeSection, setActiveSection] = useState<SectionHeader>('PRODUCT INTERPRETATION')
  const outputRef = useRef(output)
  outputRef.current = output

  // Start streaming if status is 'generating'
  useEffect(() => {
    if (status !== 'generating') return

    const controller = new AbortController()

    async function stream() {
      try {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: initialPrompt, buildId }),
          signal: controller.signal,
        })

        if (!res.ok || !res.body) {
          setStatus('error')
          return
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const raw = line.slice(6)
            try {
              const event = JSON.parse(raw) as { type: string; text?: string }
              if (event.type === 'delta' && event.text) {
                setOutput(prev => prev + event.text)
              } else if (event.type === 'done') {
                setStatus('complete')
              } else if (event.type === 'error') {
                setStatus('error')
              }
            } catch {}
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setStatus('error')
      }
    }

    void stream()
    return () => controller.abort()
  }, [buildId, initialPrompt, status])

  const sections = extractSections(output)
  const buildSection = sections['BUILD']
  const codeBlocks = buildSection ? extractCodeBlocks(buildSection) : []

  const availableSections = SECTION_HEADERS.filter(h => sections[h] || status === 'generating')

  function downloadAll() {
    const content = codeBlocks
      .map(b => `// ===== ${b.filename} =====\n\n${b.code}`)
      .join('\n\n\n')
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `build-${buildId.slice(0, 8)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex h-full">
      {/* Section nav */}
      <aside className="w-44 border-r border-border bg-surface shrink-0 py-4 px-2 space-y-0.5 overflow-y-auto">
        <Link href="/build" className="flex items-center gap-2 text-xs text-text-muted hover:text-text px-3 py-2 mb-2 transition-colors">
          <ArrowLeft size={12} /> New build
        </Link>
        {availableSections.map((h) => (
          <button
            key={h}
            onClick={() => setActiveSection(h)}
            className={cn(
              'w-full flex items-center justify-between text-left px-3 py-2 rounded-lg text-xs transition-colors',
              activeSection === h
                ? 'bg-primary/15 text-primary-light font-medium'
                : 'text-text-soft hover:text-text hover:bg-background'
            )}
          >
            <span>{SECTION_LABELS[h] ?? h}</span>
            {sections[h] ? (
              <Check size={10} className="text-emerald-400/70 shrink-0" />
            ) : (
              <Loader2 size={10} className="text-primary-light/50 animate-spin shrink-0" />
            )}
          </button>
        ))}
      </aside>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-8 py-8">
          {/* Top bar */}
          <div className="flex items-start justify-between mb-8 gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {status === 'generating' && (
                  <span className="flex items-center gap-1.5 text-xs text-primary-light">
                    <Loader2 size={12} className="animate-spin" />
                    Generating...
                  </span>
                )}
                {status === 'complete' && (
                  <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                    <Check size={12} />
                    Complete
                  </span>
                )}
              </div>
              <p className="text-sm text-text-soft italic">&ldquo;{initialPrompt}&rdquo;</p>
            </div>
            {status === 'complete' && codeBlocks.length > 0 && (
              <button
                onClick={downloadAll}
                className="flex items-center gap-2 text-xs bg-surface border border-border hover:border-border-bright text-text-soft hover:text-text px-3 py-2 rounded-lg transition-colors shrink-0"
              >
                <Download size={12} />
                Download code
              </button>
            )}
          </div>

          {/* Section content */}
          {activeSection === 'BUILD' ? (
            <div>
              <h2 className="text-lg font-semibold text-text mb-4">Build</h2>
              {buildSection && (
                <>
                  <div
                    className="prose-omega mb-6"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(stripCodeBlocks(buildSection)) }}
                  />
                  {codeBlocks.length > 0 ? (
                    <CodeViewer blocks={codeBlocks} />
                  ) : status === 'generating' ? (
                    <div className="bg-surface border border-border rounded-xl p-6 flex items-center gap-3 text-text-soft text-sm">
                      <Loader2 size={16} className="animate-spin text-primary-light" />
                      Writing code...
                    </div>
                  ) : null}
                </>
              )}
              {!buildSection && status === 'generating' && (
                <div className="bg-surface border border-border rounded-xl p-8 text-center text-text-soft text-sm">
                  <Loader2 size={20} className="animate-spin text-primary-light mx-auto mb-3" />
                  Building your product...
                </div>
              )}
            </div>
          ) : (
            <SectionView
              header={activeSection}
              content={sections[activeSection] ?? ''}
              isLoading={!sections[activeSection] && status === 'generating'}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function SectionView({
  header, content, isLoading,
}: {
  header: SectionHeader
  content: string
  isLoading: boolean
}) {
  const label = SECTION_LABELS[header] ?? header

  if (isLoading) {
    return (
      <div className="bg-surface border border-border rounded-xl p-8 text-center text-text-soft text-sm">
        <Loader2 size={20} className="animate-spin text-primary-light mx-auto mb-3" />
        Working on {label}...
      </div>
    )
  }

  if (!content) return null

  return (
    <div className="animate-fade-in">
      <h2 className="text-lg font-semibold text-text mb-5 flex items-center gap-2">
        <ChevronRight size={16} className="text-primary-light" />
        {label}
      </h2>
      <div
        className="prose-omega"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
      />
    </div>
  )
}
