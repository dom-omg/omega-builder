'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Loader2, Zap } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const EXAMPLES = [
  'A SaaS for freelancers to track invoices and chase late payments automatically',
  'A landing page for a premium online fitness coaching program',
  'An internal tool for e-commerce teams to monitor return and refund patterns',
  'A marketplace where architects sell reusable floor plan templates',
  'A habit tracker that predicts when you\'ll break streaks using AI',
  'A dashboard for a construction company to track project status in real-time',
]

interface Props {
  canBuild: boolean
}

export default function BuilderClient({ canBuild }: Props) {
  const router = useRouter()
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleBuild = useCallback(async (value: string) => {
    const trimmed = value.trim()
    if (!trimmed || loading) return
    if (!canBuild) {
      setError('You\'ve reached your free build limit. Upgrade to Pro for unlimited builds.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Create the build record first
      const res = await fetch('/api/builds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: trimmed }),
      })

      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? 'Failed to start build')
      }

      const { buildId } = await res.json() as { buildId: string }

      // Navigate to the build result page which handles streaming
      router.push(`/builds/${buildId}?prompt=${encodeURIComponent(trimmed)}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }, [loading, canBuild, router])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      void handleBuild(prompt)
    }
  }

  function useExample(ex: string) {
    setPrompt(ex)
    textareaRef.current?.focus()
  }

  return (
    <div className="min-h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-border px-8 py-6">
        <h1 className="text-xl font-bold text-text">New build</h1>
        <p className="text-sm text-text-soft mt-0.5">Describe your product in one sentence.</p>
      </div>

      {/* Main input area */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-12 max-w-3xl mx-auto w-full">
        <div className="w-full space-y-4">
          <div
            className={cn(
              'relative bg-surface border rounded-2xl transition-all',
              error ? 'border-red-500/50' : 'border-border hover:border-border-bright focus-within:border-primary/50 focus-within:surface-glow'
            )}
          >
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="A SaaS for freelance designers to manage client feedback and revisions..."
              disabled={loading}
              rows={4}
              className="w-full bg-transparent text-text placeholder:text-text-muted resize-none outline-none px-5 pt-5 pb-14 text-base leading-relaxed disabled:opacity-60"
            />

            <div className="absolute bottom-4 left-5 right-5 flex items-center justify-between">
              <p className="text-xs text-text-muted">
                {prompt.length > 0 ? `${prompt.length} chars` : '⌘ + Enter to build'}
              </p>
              <button
                onClick={() => void handleBuild(prompt)}
                disabled={!prompt.trim() || loading}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all',
                  prompt.trim() && !loading
                    ? 'bg-primary hover:bg-primary-hover text-white'
                    : 'bg-background text-text-muted border border-border cursor-not-allowed'
                )}
              >
                {loading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Zap size={14} />
                    Build
                    <ArrowRight size={13} />
                  </>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}
        </div>

        {/* Examples */}
        <div className="w-full mt-10">
          <p className="text-xs text-text-muted uppercase tracking-widest mb-4 font-medium">Examples</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => useExample(ex)}
                disabled={loading}
                className="text-left text-xs text-text-soft bg-surface hover:bg-border border border-border hover:border-border-bright rounded-xl px-4 py-3 transition-all leading-relaxed disabled:opacity-50"
              >
                &ldquo;{ex}&rdquo;
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
