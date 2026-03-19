import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Clock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

interface Build {
  id: string
  prompt: string
  product_name: string | null
  product_type: string | null
  status: string
  created_at: string
  tokens_used: number | null
}

const TYPE_COLORS: Record<string, string> = {
  saas: 'bg-violet-500/15 text-violet-300',
  landing: 'bg-blue-500/15 text-blue-300',
  app: 'bg-emerald-500/15 text-emerald-300',
  dashboard: 'bg-amber-500/15 text-amber-300',
  marketplace: 'bg-rose-500/15 text-rose-300',
  tool: 'bg-cyan-500/15 text-cyan-300',
  website: 'bg-indigo-500/15 text-indigo-300',
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'complete') return <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
  if (status === 'error') return <AlertCircle size={14} className="text-red-400 shrink-0" />
  return <Loader2 size={14} className="text-primary-light animate-spin shrink-0" />
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: builds } = await supabase
    .from('builds')
    .select('id, prompt, product_name, product_type, status, created_at, tokens_used')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const list = (builds as Build[] | null) ?? []

  return (
    <div className="max-w-5xl mx-auto px-8 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text">Your builds</h1>
          <p className="text-sm text-text-soft mt-1">{list.length} total</p>
        </div>
        <Link
          href="/build"
          className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
        >
          <Plus size={15} />
          New build
        </Link>
      </div>

      {list.length === 0 ? (
        <div className="border border-dashed border-border rounded-2xl py-20 text-center">
          <p className="text-text-soft text-sm mb-4">No builds yet.</p>
          <Link
            href="/build"
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            <Plus size={15} />
            Build your first product
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((build) => (
            <Link
              key={build.id}
              href={`/builds/${build.id}`}
              className="group flex items-start gap-4 bg-surface border border-border hover:border-border-bright rounded-xl px-5 py-4 transition-all"
            >
              <div className="flex-1 min-w-0 flex items-start gap-3">
                <StatusIcon status={build.status} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <h3 className="font-medium text-text text-sm">
                      {build.product_name ?? (build.status === 'generating' ? 'Generating...' : 'Untitled')}
                    </h3>
                    {build.product_type && (
                      <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${TYPE_COLORS[build.product_type] ?? 'bg-surface text-text-muted'}`}>
                        {build.product_type}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-muted truncate">{build.prompt}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0 text-xs text-text-muted mt-0.5">
                <span className="flex items-center gap-1">
                  <Clock size={11} />
                  {new Date(build.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
                <span className="text-border-bright group-hover:text-text-soft transition-colors">→</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
