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
- ALL content must be hardcoded directly in the HTML as visible text and elements — NOT rendered by JavaScript
- The <body> must contain real visible HTML elements (divs, headings, paragraphs, buttons) with actual text
- Use inline styles or a <style> block for a beautiful dark UI
- JavaScript is only for interactions (click handlers, tab switching) — NEVER for rendering initial content
- Include realistic hardcoded demo data: fake users, messages, charts, metrics, whatever fits the product
- Background colors must NOT be pure black (#000) — use #0f0f1a or #111827 or similar dark but non-black
- ALL text must be visible (light colors on dark background)
- Output ONLY raw HTML starting with <!DOCTYPE html>`,
      messages: [{
        role: 'user',
        content: `Generate a complete demo for this product with all content hardcoded in HTML (not JS-rendered). Show the product name, description, and realistic fake data immediately:\n\n${specSnippet}\n\nReturn ONLY the raw HTML.`,
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
