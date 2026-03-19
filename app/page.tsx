import Link from 'next/link'
import { ArrowRight, Zap, Code2, Layers, Rocket } from 'lucide-react'

const EXAMPLES = [
  { label: 'SaaS', idea: 'A SaaS for freelancers to track invoices and get paid faster' },
  { label: 'App', idea: 'A habit tracker that uses AI to predict when you\'ll break streaks' },
  { label: 'Marketplace', idea: 'A marketplace for architects to sell reusable floor plan templates' },
  { label: 'Tool', idea: 'An internal tool for e-commerce teams to monitor refund patterns' },
  { label: 'Landing', idea: 'A landing page for a premium dog training program' },
  { label: 'Dashboard', idea: 'A real-time dashboard for a logistics company' },
]

const CAPABILITIES = [
  {
    icon: <Zap size={20} />,
    title: 'Product Strategy',
    desc: 'Interprets your idea, fills missing gaps, upgrades weak positioning. No hand-holding required.',
  },
  {
    icon: <Layers size={20} />,
    title: 'Full Architecture',
    desc: 'Data models, API routes, auth flow, billing, pages, components — every decision made.',
  },
  {
    icon: <Code2 size={20} />,
    title: 'Production Code',
    desc: 'TypeScript strict, no filler, no broken imports. Runs on Next.js 15 + Supabase out of the box.',
  },
  {
    icon: <Rocket size={20} />,
    title: 'Deploy-Ready',
    desc: 'Deployment notes, environment variables, Vercel config — from idea to live in minutes.',
  },
]

const PRICING = [
  {
    name: 'Free',
    price: '$0',
    period: '',
    desc: 'Explore the engine',
    features: ['3 builds / month', 'Full spec + code', 'All product types'],
    cta: 'Start free',
    href: '/login',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '$29',
    period: '/ month',
    desc: 'For builders who ship fast',
    features: ['Unlimited builds', 'Build history', 'Priority generation', 'Export as zip'],
    cta: 'Get Pro',
    href: '/login?plan=pro',
    highlight: true,
  },
  {
    name: 'Team',
    price: '$79',
    period: '/ month',
    desc: 'For product teams',
    features: ['5 team members', 'Shared build library', 'Custom AI persona', 'Priority support'],
    cta: 'Get Team',
    href: '/login?plan=team',
    highlight: false,
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-text">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="font-semibold tracking-tight text-gradient">ΩBuilder</span>
          <div className="flex items-center gap-6">
            <a href="#pricing" className="text-sm text-text-muted hover:text-text transition-colors">Pricing</a>
            <Link
              href="/login"
              className="text-sm bg-primary hover:bg-primary-hover text-white px-4 py-1.5 rounded-lg transition-colors font-medium"
            >
              Start building
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-24 px-6 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-surface border border-border rounded-full px-4 py-1.5 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-slow" />
          <span className="text-xs text-text-soft font-medium">Powered by Claude claude-sonnet-4-6</span>
        </div>

        <h1 className="text-5xl sm:text-7xl font-bold tracking-tight mb-6 leading-[1.05]">
          <span className="text-gradient">One sentence.</span>
          <br />
          <span className="text-text">Full product.</span>
        </h1>

        <p className="text-lg sm:text-xl text-text-soft max-w-2xl mx-auto mb-10 leading-relaxed">
          Describe your idea. Get a complete product spec, architecture diagram,
          design system, and production-ready code — in under 60 seconds.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/login"
            className="group flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-6 py-3 rounded-xl font-semibold text-base transition-all animate-glow-pulse"
          >
            Start building free
            <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <span className="text-sm text-text-muted">3 free builds · No card required</span>
        </div>
      </section>

      {/* Example prompts */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-sm text-text-muted uppercase tracking-widest mb-8 font-medium">
            What can you build?
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {EXAMPLES.map((ex) => (
              <div
                key={ex.label}
                className="group bg-surface border border-border hover:border-border-bright rounded-xl p-4 transition-all cursor-default"
              >
                <span className="inline-block text-xs font-medium bg-primary/15 text-primary-light px-2 py-0.5 rounded-md mb-3">
                  {ex.label}
                </span>
                <p className="text-sm text-text-soft leading-relaxed">&ldquo;{ex.idea}&rdquo;</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="py-20 px-6 border-t border-border">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-sm text-text-muted uppercase tracking-widest mb-12 font-medium">
            What ΩBuilder produces
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {CAPABILITIES.map((cap) => (
              <div key={cap.title} className="bg-surface border border-border rounded-xl p-6">
                <div className="w-9 h-9 bg-primary/10 text-primary-light rounded-lg flex items-center justify-center mb-4">
                  {cap.icon}
                </div>
                <h3 className="font-semibold text-text mb-2">{cap.title}</h3>
                <p className="text-sm text-text-soft leading-relaxed">{cap.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social proof strip */}
      <section className="py-12 px-6 border-t border-border bg-surface/40">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-text-muted text-sm mb-1">Built for the speed of modern product teams</p>
          <p className="text-2xl font-bold text-text">
            From &ldquo;I have an idea&rdquo; to working code in <span className="text-primary-light">under 60 seconds</span>.
          </p>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-6 border-t border-border">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-3 text-gradient">Pricing</h2>
          <p className="text-center text-text-soft mb-14">Start free. Upgrade when you need more.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {PRICING.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl p-6 border transition-all ${
                  plan.highlight
                    ? 'bg-primary/10 border-primary/40 surface-glow'
                    : 'bg-surface border-border'
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-xs font-semibold px-3 py-1 rounded-full">
                    Most popular
                  </div>
                )}
                <p className="text-text-muted text-sm mb-1">{plan.name}</p>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-3xl font-bold text-text">{plan.price}</span>
                  <span className="text-text-muted text-sm">{plan.period}</span>
                </div>
                <p className="text-text-soft text-sm mb-6">{plan.desc}</p>
                <ul className="space-y-2 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-text-soft">
                      <span className="w-4 h-4 rounded-full bg-primary/20 text-primary-light flex items-center justify-center text-xs">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.href}
                  className={`block w-full text-center py-2.5 rounded-xl font-medium text-sm transition-colors ${
                    plan.highlight
                      ? 'bg-primary hover:bg-primary-hover text-white'
                      : 'bg-background hover:bg-border text-text border border-border'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm font-semibold text-gradient">ΩBuilder</span>
          <p className="text-xs text-text-muted">Built with Claude claude-sonnet-4-6 · Deploy on Vercel · Own your code</p>
        </div>
      </footer>
    </div>
  )
}
