import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { buildId } = await req.json() as { buildId: string }
    if (!buildId) return NextResponse.json({ error: 'Missing buildId' }, { status: 400 })

    const { data: build } = await supabase
      .from('builds')
      .select('output, prompt, product_name, status')
      .eq('id', buildId)
      .eq('user_id', user.id)
      .single()

    if (!build) return NextResponse.json({ error: 'Build not found' }, { status: 404 })
    if (build.status !== 'complete') return NextResponse.json({ error: 'Build not complete' }, { status: 400 })

    const specSnippet = (build.output ?? build.prompt ?? '').slice(0, 3000)

    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      system: `You are a web app generator. Output ONLY a complete, self-contained index.html file.

CRITICAL RULES:
- Pure HTML/CSS/JS only — no frameworks, no npm, no external CDN imports
- Must show rich, visible content IMMEDIATELY on load — never a blank or empty screen
- Beautiful polished dark UI: deep backgrounds, gradients, clear typography
- Include hardcoded demo/sample data so the app looks ALIVE and FULL
- For any AI chat: show a realistic demo conversation already visible on load
- For dashboards: show fake but realistic data, charts drawn with canvas/SVG
- For tools: show example output already rendered
- The goal: someone opening this should immediately say "wow, this is real"
- Output ONLY raw HTML starting with <!DOCTYPE html>`,
      messages: [{
        role: 'user',
        content: `Generate a complete interactive demo for this product. Include realistic sample data and demo content so it looks fully functional:\n\n${specSnippet}\n\nReturn ONLY the raw HTML.`,
      }],
    })

    const text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
    const html = text.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim()

    if (!html || !html.includes('<html')) {
      return NextResponse.json({ error: 'Failed to generate preview' }, { status: 500 })
    }

    return NextResponse.json({ html })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Preview failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
