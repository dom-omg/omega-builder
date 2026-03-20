import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { OMEGA_SYSTEM_PROMPT, buildUserPrompt } from '@/lib/ai/prompts'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export const runtime = 'edge'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Check build quota
    const { data: profile } = await supabase
      .from('profiles')
      .select('builds_used, builds_limit, plan')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), { status: 404 })
    }

    if (profile.plan === 'free' && profile.builds_used >= profile.builds_limit) {
      return new Response(JSON.stringify({ error: 'quota_exceeded' }), { status: 429 })
    }

    const { prompt, buildId } = await req.json() as { prompt: string; buildId: string }

    if (!prompt?.trim() || !buildId) {
      return new Response(JSON.stringify({ error: 'Missing prompt or buildId' }), { status: 400 })
    }

    // Create SSE stream
    const encoder = new TextEncoder()
    let fullOutput = ''
    let tokenCount = 0

    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: string) => {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`))
        }

        try {
          const response = await anthropic.messages.stream({
            model: 'claude-sonnet-4-6',
            max_tokens: 16000,
            system: OMEGA_SYSTEM_PROMPT,
            messages: [{ role: 'user', content: buildUserPrompt(prompt) }],
          })

          for await (const chunk of response) {
            if (
              chunk.type === 'content_block_delta' &&
              chunk.delta.type === 'text_delta'
            ) {
              const text = chunk.delta.text
              fullOutput += text
              send(JSON.stringify({ type: 'delta', text }))
            }
          }

          const finalMessage = await response.finalMessage()
          tokenCount = finalMessage.usage.input_tokens + finalMessage.usage.output_tokens

          // Save completed build to Supabase
          await supabase
            .from('builds')
            .update({
              status: 'complete',
              output: fullOutput,
              tokens_used: tokenCount,
            })
            .eq('id', buildId)

          send(JSON.stringify({ type: 'done', buildId, tokens: tokenCount }))
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Generation failed'
          await supabase
            .from('builds')
            .update({ status: 'error' })
            .eq('id', buildId)
          send(JSON.stringify({ type: 'error', message }))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
