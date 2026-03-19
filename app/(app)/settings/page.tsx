import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .single()

  return (
    <div className="max-w-2xl mx-auto px-8 py-10">
      <h1 className="text-2xl font-bold text-text mb-8">Settings</h1>

      {/* Account */}
      <section className="bg-surface border border-border rounded-2xl p-6 mb-5">
        <h2 className="text-sm font-semibold text-text mb-4">Account</h2>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between py-2 border-b border-border">
            <span className="text-text-muted">Email</span>
            <span className="text-text">{user?.email}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border">
            <span className="text-text-muted">Name</span>
            <span className="text-text">{profile?.full_name ?? '—'}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-text-muted">Member since</span>
            <span className="text-text">
              {profile ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—'}
            </span>
          </div>
        </div>
      </section>

      {/* Plan */}
      <section className="bg-surface border border-border rounded-2xl p-6 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-text">Plan</h2>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
            profile?.plan === 'pro' ? 'bg-primary/15 text-primary-light' :
            profile?.plan === 'team' ? 'bg-emerald-500/15 text-emerald-300' :
            'bg-surface border border-border text-text-soft'
          }`}>
            {(profile?.plan ?? 'free').toUpperCase()}
          </span>
        </div>

        {profile?.plan === 'free' && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-text-muted">Builds used</span>
                <span className="text-text">{profile.builds_used} / {profile.builds_limit}</span>
              </div>
              <div className="h-1.5 bg-background rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${Math.min((profile.builds_used / profile.builds_limit) * 100, 100)}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="bg-background border border-border rounded-xl p-4">
                <p className="font-semibold text-text">Pro — $29/mo</p>
                <p className="text-xs text-text-muted mt-1">Unlimited builds + history + export</p>
                <Link
                  href="/api/stripe/checkout?plan=pro"
                  className="mt-3 block w-full text-center bg-primary hover:bg-primary-hover text-white text-xs py-2 rounded-lg font-medium transition-colors"
                >
                  Upgrade
                </Link>
              </div>
              <div className="bg-background border border-border rounded-xl p-4">
                <p className="font-semibold text-text">Team — $79/mo</p>
                <p className="text-xs text-text-muted mt-1">5 members + shared library</p>
                <Link
                  href="/api/stripe/checkout?plan=team"
                  className="mt-3 block w-full text-center bg-background hover:bg-border border border-border text-text text-xs py-2 rounded-lg font-medium transition-colors"
                >
                  Upgrade
                </Link>
              </div>
            </div>
          </div>
        )}

        {profile?.plan !== 'free' && (
          <p className="text-sm text-text-soft">
            You&apos;re on the <strong className="text-text capitalize">{profile?.plan}</strong> plan.{' '}
            <a href="#" className="text-primary-light hover:underline">Manage billing →</a>
          </p>
        )}
      </section>
    </div>
  )
}
