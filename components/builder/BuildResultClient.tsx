'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Copy, Check, ChevronRight, Loader2, Download, ArrowLeft, Rocket, ExternalLink, Play, X } from 'lucide-react'
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
  'LIVE DEMO': 'Live Demo',
}

export default function BuildResultClient({
  buildId, initialPrompt, initialOutput, initialStatus,
}: Props) {
  const [output, setOutput] = useState(initialOutput)
  const [status, setStatus] = useState(initialStatus)
  const [activeSection, setActiveSection] = useState<SectionHeader>('PRODUCT INTERPRETATION')
  const [deploying, setDeploying] = useState(false)
  const [liveUrl, setLiveUrl] = useState<string | null>(null)
  const [deployError, setDeployError] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
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
        let gotDone = false

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
                gotDone = true
                setStatus('complete')
              } else if (event.type === 'error') {
                setStatus('error')
              }
            } catch {}
          }
        }

        // Fallback: stream closed without 'done' event (edge timeout, etc.)
        // If we received output, treat as complete — don't leave user stuck on spinner
        if (!gotDone) {
          setStatus(outputRef.current.length > 100 ? 'complete' : 'error')
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

  async function previewApp() {
    setPreviewing(true)
    setPreviewError(null)
    try {
      const res = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buildId }),
      })
      const data = await res.json() as { html?: string; error?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? 'Preview failed')
      setPreviewHtml(data.html ?? null)
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Preview failed')
    } finally {
      setPreviewing(false)
    }
  }

  async function deployLive() {
    setDeploying(true)
    setDeployError(null)
    try {
      const res = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buildId }),
      })
      const data = await res.json() as { url?: string; error?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? 'Deploy failed')
      setLiveUrl(data.url ?? null)
    } catch (err) {
      setDeployError(err instanceof Error ? err.message : 'Deploy failed')
    } finally {
      setDeploying(false)
    }
  }

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
      <aside className="w-44 border-r border-border bg-surface shrink-0 py-4 px-2 space-y-0.5 overflow-y-auto" style={{ display: previewHtml ? 'none' : undefined }}>
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
      <div className={previewHtml ? 'hidden' : 'flex-1 overflow-y-auto'}>
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
            {status === 'complete' && (
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                {/* Launch App button — always visible on complete builds */}
                {previewHtml ? (
                  <button
                    onClick={() => setPreviewHtml(null)}
                    className="flex items-center gap-2 text-xs bg-primary/15 border border-primary/30 text-primary-light hover:bg-primary/25 px-3 py-2 rounded-lg transition-colors"
                  >
                    <X size={12} />
                    Close preview
                  </button>
                ) : (
                  <button
                    onClick={previewApp}
                    disabled={previewing}
                    className="flex items-center gap-2 text-sm font-semibold bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
                  >
                    {previewing ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                    {previewing ? 'Launching...' : 'Launch App'}
                  </button>
                )}
                {/* Deploy button — secondary */}
                {liveUrl ? (
                  <a
                    href={liveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 px-3 py-2 rounded-lg transition-colors"
                  >
                    <ExternalLink size={12} />
                    Open live
                  </a>
                ) : (
                  <button
                    onClick={deployLive}
                    disabled={deploying}
                    className="flex items-center gap-2 text-xs bg-surface border border-border hover:border-border-bright text-text-soft hover:text-text px-3 py-2 rounded-lg transition-colors disabled:opacity-60"
                  >
                    {deploying ? <Loader2 size={12} className="animate-spin" /> : <Rocket size={12} />}
                    {deploying ? 'Deploying...' : 'Deploy'}
                  </button>
                )}
                <button
                  onClick={downloadAll}
                  className="flex items-center gap-2 text-xs bg-surface border border-border hover:border-border-bright text-text-soft hover:text-text px-3 py-2 rounded-lg transition-colors"
                >
                  <Download size={12} />
                  Code
                </button>
              </div>
            )}
            {(deployError || previewError) && (
              <p className="text-xs text-red-400 mt-1">{deployError ?? previewError}</p>
            )}
          </div>

          {/* Launch CTA banner — shown at top when complete and no preview open */}
          {status === 'complete' && !previewHtml && (
            <div className="mb-6 bg-primary/8 border border-primary/20 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-text">Your app is ready.</p>
                <p className="text-xs text-text-soft mt-0.5">Click Launch App to see it running live.</p>
              </div>
              <button
                onClick={previewApp}
                disabled={previewing}
                className="flex items-center gap-2 text-sm font-semibold bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg transition-colors shrink-0 disabled:opacity-60"
              >
                {previewing ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                {previewing ? 'Launching...' : 'Launch App'}
              </button>
            </div>
          )}

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
      {/* Preview iframe panel */}
      {previewHtml && (
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface shrink-0">
            <span className="text-xs text-text-soft flex items-center gap-1.5">
              <Play size={10} className="text-primary-light" />
              Live preview
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={deployLive}
                disabled={deploying}
                className="flex items-center gap-1.5 text-xs text-text-soft hover:text-text transition-colors disabled:opacity-60"
              >
                {deploying ? <Loader2 size={10} className="animate-spin" /> : <Rocket size={10} />}
                {deploying ? 'Deploying...' : 'Deploy live'}
              </button>
              {liveUrl && (
                <a href={liveUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
                  <ExternalLink size={10} />
                  Open live
                </a>
              )}
              <button
                onClick={() => setPreviewHtml(null)}
                className="text-text-muted hover:text-text transition-colors ml-2"
              >
                <X size={14} />
              </button>
            </div>
          </div>
          <iframe
            srcDoc={previewHtml}
            className="flex-1 w-full border-0"
            title="App preview"
          />
        </div>
      )}
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
