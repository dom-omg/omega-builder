import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const VERCEL_TOKEN = process.env.VERCEL_TOKEN!
const VERCEL_TEAM = process.env.VERCEL_TEAM_ID ?? 'team_DuQZyAPRlGsj3jKMM84hqiAi'

function slugify(name: string): string {
  return 'omg-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 28)
    + '-' + Date.now().toString(36)
}

async function generateFile(prompt: string, systemPrompt: string): Promise<string> {
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt }],
  })
  const text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
  return text.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim()
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
      .select('output, prompt, product_name, status')
      .eq('id', buildId)
      .eq('user_id', user.id)
      .single()

    if (!build) return NextResponse.json({ error: 'Build not found' }, { status: 404 })
    if (build.status !== 'complete') return NextResponse.json({ error: 'Build not complete' }, { status: 400 })

    const specSnippet = (build.output ?? build.prompt ?? '').slice(0, 3000)

    // ── Step 1: Generate index.html ──
    const htmlContent = await generateFile(
      `Generate a complete, fully functional index.html for this product:\n\n${specSnippet}\n\nReturn ONLY the raw HTML file content. No explanation, no markdown, no code fences.`,
      `You are a web app generator. Output ONLY a complete index.html file — pure HTML/CSS/JS, no frameworks, no external CDN imports.

CRITICAL RULES:
- The page MUST show visible content immediately on load — never a blank screen
- Always show a welcome message, product name, and description above any input
- Beautiful, polished dark UI with actual color, gradients, and visible text
- For AI/chat features: call POST /api/chat with body { messages: [{role:"user", content:"..."}] }
- Parse SSE stream from /api/chat: each line starts with "data: " followed by JSON { type:"content_block_delta", delta:{ type:"text_delta", text:"..." } }
- Show a "Powered by Claude AI" badge somewhere
- Output ONLY raw HTML starting with <!DOCTYPE html>`
    )

    if (!htmlContent || !htmlContent.includes('<html')) {
      return NextResponse.json({ error: 'Failed to generate HTML — try again' }, { status: 500 })
    }

    // ── Step 2: Generate api/chat.js (NO npm deps — uses raw fetch to Anthropic API) ──
    const apiContent = await generateFile(
      `Generate a Vercel serverless API handler at api/chat.js for this product:\n\n${specSnippet}\n\nReturn ONLY the raw JavaScript file content. No explanation, no markdown, no code fences.`,
      `You are a serverless API generator. Output ONLY a complete api/chat.js Vercel serverless function.

CRITICAL: Use ZERO npm dependencies. Use native Node.js fetch() to call the Anthropic API directly.

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { messages } = req.body

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      stream: true,
      system: '...system prompt for this product...',
      messages,
    }),
  })

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    res.write(decoder.decode(value))
  }
  res.end()
}

Use this exact pattern. Customize only the system prompt for the product. Output ONLY raw JavaScript starting with module.exports`
    )

    if (!apiContent || !apiContent.includes('module.exports')) {
      return NextResponse.json({ error: 'Failed to generate API — try again' }, { status: 500 })
    }

    // ── Step 3: Deploy to Vercel (no npm install needed — zero deps) ──
    const projectName = slugify(build.product_name ?? 'app')

    const res = await fetch(`https://api.vercel.com/v13/deployments?teamId=${VERCEL_TEAM}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: projectName,
        files: [
          { file: 'index.html', data: htmlContent },
          { file: 'api/chat.js', data: apiContent },
        ],
        target: 'production',
        projectSettings: {
          framework: null,
          buildCommand: '',
          outputDirectory: '',
          installCommand: '',
        },
        env: {
          ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? '',
        },
      }),
    })

    const data = await res.json() as { url?: string; id?: string; error?: { message: string } }

    if (!res.ok || data.error) {
      throw new Error(data.error?.message ?? `Vercel ${res.status}`)
    }

    const liveUrl = `https://${data.url}`

    await supabase
      .from('builds')
      .update({ sections: { live_url: liveUrl } })
      .eq('id', buildId)

    return NextResponse.json({ url: liveUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Deploy failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
