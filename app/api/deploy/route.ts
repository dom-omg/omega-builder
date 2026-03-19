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

function extractFile(text: string, filename: string): string | null {
  const escaped = filename.replace('.', '\\.').replace('/', '\\/')
  const r = new RegExp(`\`\`\`(?:\\w+)\\s+filename="${escaped}"\\n([\\s\\S]*?)\`\`\``)
  const m = text.match(r)
  return m ? m[1].trim() : null
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

    // ── Step 1: Ask Claude to generate 2 deployable files ──
    const specSnippet = (build.output ?? build.prompt ?? '').slice(0, 4000)

    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      system: `You generate exactly 2 files for instant Vercel deployment.
Output ONLY these 2 code blocks, nothing else:

\`\`\`html filename="index.html"
<!-- Complete single-file app. Pure HTML/CSS/JS. No frameworks, no imports.
     Call /api/chat via fetch() for AI. Fully functional and polished UI. -->
\`\`\`

\`\`\`javascript filename="api/chat.js"
// Vercel edge serverless. Use CommonJS require() not ES import.
// export const config = { runtime: 'edge' }
// export default async function handler(req) { streams SSE to client }
// Use: const Anthropic = require('@anthropic-ai/sdk')
\`\`\`

Rules:
- index.html must be a complete, working, beautiful UI
- api/chat.js must use CommonJS (require, not import) and stream SSE
- No TypeScript, no Next.js, no build step needed
- ANTHROPIC_API_KEY is available as process.env.ANTHROPIC_API_KEY`,
      messages: [{
        role: 'user',
        content: `Generate the 2 deployable files for this product:\n\n${specSnippet}`,
      }],
    })

    const generatedText = msg.content[0].type === 'text' ? msg.content[0].text : ''

    const htmlContent = extractFile(generatedText, 'index.html')
    const apiContent = extractFile(generatedText, 'api/chat.js')

    if (!htmlContent || !apiContent) {
      return NextResponse.json({ error: 'Failed to generate deployable files' }, { status: 500 })
    }

    const pkgJson = JSON.stringify({
      name: slugify(build.product_name ?? 'app'),
      version: '1.0.0',
      dependencies: { '@anthropic-ai/sdk': '^0.39.0' },
    }, null, 2)

    // ── Step 2: Deploy to Vercel ───────────────────────────
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
          { file: 'package.json', data: pkgJson },
        ],
        target: 'production',
        projectSettings: {
          framework: null,
          buildCommand: '',
          outputDirectory: '',
          installCommand: 'npm install',
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
