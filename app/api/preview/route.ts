import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function extractHtmlFromOutput(output: string): string | null {
  // Look for ```html filename="index.html" block anywhere in the output
  const regex = /```html\s+filename="index\.html"\s*\n([\s\S]*?)```/i
  const match = output.match(regex)
  if (match) return match[1].trim()

  // Fallback: any ```html block that looks like a full page
  const fallback = /```html\s*\n([\s\S]*?```)/g
  let m: RegExpExecArray | null
  while ((m = fallback.exec(output)) !== null) {
    const content = m[1].replace(/```$/, '').trim()
    if (content.includes('<!DOCTYPE') || content.includes('<html')) return content
  }
  return null
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { buildId } = await req.json() as { buildId: string }
    if (!buildId) return NextResponse.json({ error: 'Missing buildId' }, { status: 400 })

    const { data: build } = await supabase
      .from('builds')
      .select('output, prompt, status')
      .eq('id', buildId)
      .eq('user_id', user.id)
      .single()

    if (!build) return NextResponse.json({ error: 'Build not found' }, { status: 404 })
    if (build.status !== 'complete') return NextResponse.json({ error: 'Build not complete' }, { status: 400 })

    const html = extractHtmlFromOutput(build.output ?? '')

    if (!html) {
      return NextResponse.json({ error: 'No preview found in build — try rebuilding' }, { status: 404 })
    }

    return NextResponse.json({ html })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Preview failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
