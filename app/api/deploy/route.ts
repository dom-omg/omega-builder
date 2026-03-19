import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const VERCEL_TOKEN = process.env.VERCEL_TOKEN
const VERCEL_TEAM = process.env.VERCEL_TEAM_ID ?? 'team_DuQZyAPRlGsj3jKMM84hqiAi'

interface CodeFile {
  filename: string
  code: string
}

function parseCodeFiles(output: string): CodeFile[] {
  const files: CodeFile[] = []
  const regex = /```(?:\w+)\s+filename="([^"]+)"\n([\s\S]*?)```/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(output)) !== null) {
    files.push({ filename: match[1], code: match[2].trim() })
  }
  return files
}

function toBase64(str: string): string {
  return Buffer.from(str, 'utf-8').toString('base64')
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) + '-' + Math.random().toString(36).slice(2, 7)
}

function buildVercelFiles(codeFiles: CodeFile[]) {
  const vercelFiles: { file: string; data: string; encoding: string }[] = []

  for (const f of codeFiles) {
    vercelFiles.push({
      file: f.filename,
      data: toBase64(f.code),
      encoding: 'base64',
    })
  }

  // Auto-add package.json if missing and there are .js/.ts files
  const hasApiFiles = codeFiles.some(f => f.filename.startsWith('api/'))
  const hasPkg = codeFiles.some(f => f.filename === 'package.json')
  if (hasApiFiles && !hasPkg) {
    const pkgJson = JSON.stringify({
      name: 'deployed-app',
      version: '1.0.0',
      dependencies: { '@anthropic-ai/sdk': '^0.39.0' },
    }, null, 2)
    vercelFiles.push({ file: 'package.json', data: toBase64(pkgJson), encoding: 'base64' })
  }

  return vercelFiles
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { buildId } = await req.json() as { buildId: string }
    if (!buildId) return NextResponse.json({ error: 'Missing buildId' }, { status: 400 })

    // Get the build
    const { data: build } = await supabase
      .from('builds')
      .select('output, product_name, status')
      .eq('id', buildId)
      .eq('user_id', user.id)
      .single()

    if (!build?.output) return NextResponse.json({ error: 'Build not found or incomplete' }, { status: 404 })
    if (build.status !== 'complete') return NextResponse.json({ error: 'Build not complete yet' }, { status: 400 })

    const codeFiles = parseCodeFiles(build.output)
    if (codeFiles.length === 0) return NextResponse.json({ error: 'No deployable files found in this build' }, { status: 400 })

    const projectName = slugify(build.product_name ?? 'app')
    const vercelFiles = buildVercelFiles(codeFiles)

    // Deploy via Vercel API (file-based, no git)
    const deployRes = await fetch(
      `https://api.vercel.com/v13/deployments?teamId=${VERCEL_TEAM}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${VERCEL_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: projectName,
          files: vercelFiles,
          target: 'production',
          projectSettings: {
            framework: null,
            buildCommand: null,
            outputDirectory: null,
          },
          env: {
            ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? '',
          },
        }),
      }
    )

    const deployData = await deployRes.json() as {
      id?: string
      url?: string
      error?: { message: string }
      readyState?: string
    }

    if (!deployRes.ok || deployData.error) {
      throw new Error(deployData.error?.message ?? `Deploy failed: ${deployRes.status}`)
    }

    const liveUrl = `https://${deployData.url}`

    // Save live URL to the build
    await supabase
      .from('builds')
      .update({ sections: { live_url: liveUrl, deploy_id: deployData.id } })
      .eq('id', buildId)

    return NextResponse.json({ url: liveUrl, deployId: deployData.id })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Deploy failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
