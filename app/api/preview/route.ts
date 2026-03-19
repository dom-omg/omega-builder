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
      system: `You generate a complete self-contained HTML app for live preview inside an iframe.

The app can use fetch('/api/chat') for AI features — this endpoint is available and works.

/api/chat accepts: POST { messages: [{role, content}], system?: string }
It streams SSE events. Each event is: data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"..."}}
Stream ends with: data: {"type":"message_stop"}

STRUCTURE RULES:
- Output a complete <!DOCTYPE html> page
- ALL initial UI content must be hardcoded HTML — never JS-rendered on load
- Use a <style> block in <head> for styling (dark theme, polished)
- JS is allowed for: chat interactions, sending messages, rendering AI responses
- Include a realistic hardcoded demo conversation or sample data so the app looks full immediately
- The product must be usable: user can type and chat with the AI right away

STYLE:
- Dark theme: background #0f172a, cards #1e293b, text #f1f5f9
- Clean, modern, polished — not generic
- Fully responsive`,
      messages: [{
        role: 'user',
        content: `Generate a complete interactive preview for this product. Include hardcoded demo content visible immediately AND a working chat interface that calls /api/chat:\n\n${specSnippet}\n\nReturn a complete <!DOCTYPE html> page.`,
      }],
    })

    const text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
    const html = text.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim()

    if (!html || !html.includes('<!DOCTYPE')) {
      return NextResponse.json({ error: 'Failed to generate preview' }, { status: 500 })
    }

    return NextResponse.json({ html })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Preview failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
