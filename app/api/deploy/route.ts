import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const VERCEL_TOKEN = process.env.VERCEL_TOKEN!
const VERCEL_TEAM = process.env.VERCEL_TEAM_ID ?? 'team_DuQZyAPRlGsj3jKMM84hqiAi'

interface CodeFile { filename: string; code: string }

function parseLiveDemoFiles(output: string): CodeFile[] {
  // Extract only the LIVE DEMO section
  const sectionMatch = output.match(/## 11\. LIVE DEMO[\s\S]*$/i)
  const section = sectionMatch ? sectionMatch[0] : output

  const files: CodeFile[] = []
  const regex = /```(?:\w+)\s+filename="([^"]+)"\n([\s\S]*?)```/g
  let m: RegExpExecArray | null
  while ((m = regex.exec(section)) !== null) {
    files.push({ filename: m[1], code: m[2].trim() })
  }
  return files
}

function slugify(name: string): string {
  return 'omg-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 28)
    + '-' + Date.now().toString(36)
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
      .select('output, product_name, status')
      .eq('id', buildId)
      .eq('user_id', user.id)
      .single()

    if (!build?.output) return NextResponse.json({ error: 'Build not found' }, { status: 404 })
    if (build.status !== 'complete') return NextResponse.json({ error: 'Build not complete' }, { status: 400 })

    // Extract only the 2 deployable files from LIVE DEMO section
    const liveFiles = parseLiveDemoFiles(build.output)

    if (liveFiles.length === 0) {
      return NextResponse.json({ error: 'No live demo files found. Try generating a new build.' }, { status: 400 })
    }

    const projectName = slugify(build.product_name ?? 'app')

    const allFiles = [
      ...liveFiles,
      {
        filename: 'package.json',
        code: JSON.stringify({
          name: projectName,
          version: '1.0.0',
          dependencies: { '@anthropic-ai/sdk': '^0.39.0' },
        }, null, 2),
      },
    ]

    // Deploy — inline file content as plain strings (no SHA, no base64)
    const res = await fetch(`https://api.vercel.com/v13/deployments?teamId=${VERCEL_TEAM}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: projectName,
        files: allFiles.map(f => ({ file: f.filename, data: f.code })),
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
      throw new Error(data.error?.message ?? `Vercel error ${res.status}`)
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
