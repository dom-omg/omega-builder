import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface PreviewData {
  name: string
  tagline: string
  description: string
  systemPrompt: string
  features: string[]
  demoMessages: Array<{ role: 'user' | 'assistant'; content: string }>
  accentColor: string
}

function buildHtml(d: PreviewData): string {
  const featuresHtml = d.features.map(f => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:#1e293b;border-radius:8px;margin-bottom:8px;">
      <span style="color:${d.accentColor};font-size:16px;">✦</span>
      <span style="color:#cbd5e1;font-size:13px;">${f}</span>
    </div>`).join('')

  const demoHtml = d.demoMessages.map(m => {
    const isUser = m.role === 'user'
    return `<div style="display:flex;justify-content:${isUser ? 'flex-end' : 'flex-start'};margin-bottom:12px;">
      <div style="max-width:75%;padding:10px 14px;border-radius:${isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px'};background:${isUser ? d.accentColor : '#1e293b'};color:${isUser ? '#fff' : '#cbd5e1'};font-size:13px;line-height:1.5;">${m.content}</div>
    </div>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${d.name}</title>
</head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#f1f5f9;height:100vh;display:flex;flex-direction:column;">

<!-- Header -->
<div style="padding:16px 24px;border-bottom:1px solid #1e293b;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
  <div>
    <div style="font-size:18px;font-weight:700;color:#f1f5f9;">${d.name}</div>
    <div style="font-size:12px;color:#64748b;margin-top:2px;">${d.tagline}</div>
  </div>
  <div style="background:${d.accentColor}22;border:1px solid ${d.accentColor}44;color:${d.accentColor};font-size:11px;padding:4px 10px;border-radius:20px;">Live Preview</div>
</div>

<!-- Body -->
<div style="display:flex;flex:1;overflow:hidden;">

  <!-- Left panel: features -->
  <div style="width:260px;border-right:1px solid #1e293b;padding:20px;overflow-y:auto;flex-shrink:0;">
    <div style="font-size:11px;font-weight:600;color:#475569;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:12px;">About</div>
    <p style="font-size:13px;color:#94a3b8;line-height:1.6;margin:0 0 20px;">${d.description}</p>
    <div style="font-size:11px;font-weight:600;color:#475569;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:12px;">Features</div>
    ${featuresHtml}
  </div>

  <!-- Right panel: chat -->
  <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;">

    <!-- Messages -->
    <div id="messages" style="flex:1;overflow-y:auto;padding:20px;">
      ${demoHtml}
    </div>

    <!-- Input -->
    <div style="padding:16px;border-top:1px solid #1e293b;display:flex;gap:10px;flex-shrink:0;">
      <input id="input" type="text" placeholder="Message ${d.name}..."
        style="flex:1;background:#1e293b;border:1px solid #334155;border-radius:10px;padding:10px 14px;color:#f1f5f9;font-size:14px;outline:none;"
        onkeydown="if(event.key==='Enter')send()" />
      <button onclick="send()"
        style="background:${d.accentColor};color:#fff;border:none;border-radius:10px;padding:10px 18px;font-size:13px;font-weight:600;cursor:pointer;">Send</button>
    </div>
  </div>
</div>

<script>
const SYSTEM = ${JSON.stringify(d.systemPrompt)};
const messages = [];

async function send() {
  const input = document.getElementById('input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';

  messages.push({ role: 'user', content: text });
  appendMessage('user', text);

  const aiDiv = appendMessage('assistant', '');
  let aiText = '';

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, system: SYSTEM }),
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const evt = JSON.parse(line.slice(6));
          if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
            aiText += evt.delta.text;
            aiDiv.textContent = aiText;
            document.getElementById('messages').scrollTop = 999999;
          }
        } catch {}
      }
    }
    messages.push({ role: 'assistant', content: aiText });
  } catch (e) {
    aiDiv.textContent = 'Error — try again.';
  }
}

function appendMessage(role, text) {
  const wrap = document.getElementById('messages');
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;justify-content:' + (role==='user'?'flex-end':'flex-start') + ';margin-bottom:12px;';
  const bubble = document.createElement('div');
  bubble.style.cssText = 'max-width:75%;padding:10px 14px;border-radius:' + (role==='user'?'16px 16px 4px 16px':'16px 16px 16px 4px') + ';background:' + (role==='user'?'${d.accentColor}':'#1e293b') + ';color:' + (role==='user'?'#fff':'#cbd5e1') + ';font-size:13px;line-height:1.5;';
  bubble.textContent = text;
  row.appendChild(bubble);
  wrap.appendChild(row);
  wrap.scrollTop = 999999;
  return bubble;
}
</script>
</body>
</html>`
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

    const specSnippet = (build.output ?? build.prompt ?? '').slice(0, 4000)

    // Ask Claude for structured data only — we build the HTML ourselves
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      system: `Return ONLY valid JSON, no markdown, no explanation.`,
      messages: [{
        role: 'user',
        content: `Extract preview data for this product. Return ONLY this JSON shape:
{
  "name": "Product Name",
  "tagline": "One-line tagline",
  "description": "2-sentence description of what this does",
  "systemPrompt": "You are [product name], a [what it does]. Help the user [core action].",
  "features": ["Feature 1", "Feature 2", "Feature 3", "Feature 4"],
  "demoMessages": [
    {"role": "user", "content": "example question"},
    {"role": "assistant", "content": "example helpful response showing the product value"}
  ],
  "accentColor": "#6366f1"
}

Product spec:
${specSnippet}`,
      }],
    })

    const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
    const jsonText = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()

    let data: PreviewData
    try {
      data = JSON.parse(jsonText) as PreviewData
    } catch {
      return NextResponse.json({ error: 'Failed to parse preview data' }, { status: 500 })
    }

    const html = buildHtml(data)
    return NextResponse.json({ html })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Preview failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
