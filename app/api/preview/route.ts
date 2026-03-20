import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Extract the index.html code block from the LIVE DEMO section (## 11. LIVE DEMO)
 * Returns null if not found.
 */
function extractLiveDemoHtml(output: string): string | null {
  // Find the LIVE DEMO section
  const sectionMatch = output.match(/## 11\.\s+LIVE DEMO\s*([\s\S]*?)(?=## \d+\.|$)/i)
  if (!sectionMatch) return null

  const sectionContent = sectionMatch[1]

  // Extract the html code block
  const htmlMatch = sectionContent.match(/```html(?:\s+filename="[^"]*")?\s*([\s\S]*?)```/)
  if (!htmlMatch) return null

  return htmlMatch[1].trim()
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

    // Try to extract the actual generated index.html from the LIVE DEMO section
    const html = extractLiveDemoHtml(build.output ?? '')
    if (!html) {
      return NextResponse.json({ error: 'No live demo found in this build. Re-generate to get a preview.' }, { status: 404 })
    }

    return NextResponse.json({ html })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Preview failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
