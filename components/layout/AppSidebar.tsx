'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Plus, Settings, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils/cn'

interface Props {
  user: {
    email: string
    full_name?: string | null
    plan?: string | null
    builds_used?: number | null
    builds_limit?: number | null
  }
}

const NAV_ITEMS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Builds' },
  { href: '/build', icon: Plus, label: 'New build' },
  { href: '/settings', icon: Settings, label: 'Settings' },
]

export default function AppSidebar({ user }: Props) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initial = (user.full_name ?? user.email)[0]?.toUpperCase() ?? 'U'
  const plan = user.plan ?? 'free'
  const buildsUsed = user.builds_used ?? 0
  const buildsLimit = user.builds_limit ?? 3
  const quotaPercent = plan === 'free' ? Math.min((buildsUsed / buildsLimit) * 100, 100) : 0

  return (
    <aside className="w-56 border-r border-border bg-surface flex flex-col shrink-0">
      {/* Logo */}
      <div className="px-5 h-14 flex items-center border-b border-border">
        <span className="font-bold text-gradient tracking-tight">ΩBuilder</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
              pathname === href || (href === '/build' && pathname.startsWith('/build'))
                ? 'bg-primary/15 text-primary-light font-medium'
                : 'text-text-soft hover:text-text hover:bg-background'
            )}
          >
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </nav>

      {/* Bottom: quota + user */}
      <div className="px-4 pb-4 space-y-3 border-t border-border pt-4">
        {plan === 'free' && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-muted">Builds</span>
              <span className="text-text-soft">{buildsUsed} / {buildsLimit}</span>
            </div>
            <div className="h-1 bg-background rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${quotaPercent}%` }}
              />
            </div>
            {quotaPercent >= 100 && (
              <Link href="/settings?upgrade=1" className="text-xs text-primary-light hover:underline">
                Upgrade to Pro →
              </Link>
            )}
          </div>
        )}
        {plan !== 'free' && (
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-xs text-text-soft capitalize">{plan} plan</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full bg-primary/20 text-primary-light flex items-center justify-center text-xs font-semibold shrink-0">
              {initial}
            </div>
            <p className="text-xs text-text-soft truncate">{user.full_name ?? user.email}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="text-text-muted hover:text-text transition-colors ml-1 shrink-0"
            title="Sign out"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  )
}
