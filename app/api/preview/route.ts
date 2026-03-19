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
      max_tokens: 6000,
      system: `You output ONLY raw HTML body content — no <!DOCTYPE>, no <html>, no <head>, no <body> tags, no <style> tags, no <script> tags.

Output ONLY the inner HTML that goes inside <body>: divs, sections, headers, cards, text, buttons, etc.

Rules:
- Use inline style attributes on every element for all styling
- ALL content must be hardcoded text and elements — no JavaScript, no dynamic rendering
- Include realistic fake/demo data: names, numbers, messages, metrics, whatever fits
- Rich, detailed content — multiple sections, cards, lists
- Dark theme: use style="background:#1e293b" or similar dark blues/grays, light text
- Make it look like a real working app with data in it`,
      messages: [{
        role: 'user',
        content: `Generate the body content (inline-styled HTML only, no scripts, no style tags) for this product demo. Include the product name as an <h1> and lots of realistic demo data:\n\n${specSnippet}`,
      }],
    })

    const bodyContent = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''

    if (!bodyContent) {
      return NextResponse.json({ error: 'Failed to generate preview' }, { status: 500 })
    }

    // Wrap in a guaranteed-render HTML shell
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Preview</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#f1f5f9;min-height:100vh;">
${bodyContent}
</body>
</html>`

    return NextResponse.json({ html })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Preview failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
