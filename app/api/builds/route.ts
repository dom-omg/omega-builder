import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { prompt } = await req.json() as { prompt: string }
    if (!prompt?.trim()) return NextResponse.json({ error: 'Missing prompt' }, { status: 400 })

    const { data, error } = await supabase
      .from('builds')
      .insert({
        user_id: user.id,
        prompt: prompt.trim(),
        status: 'generating',
      })
      .select('id')
      .single()

    if (error) throw error

    return NextResponse.json({ buildId: data.id })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create build'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('builds')
      .select('id, prompt, product_name, product_type, status, created_at, tokens_used')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error
    return NextResponse.json({ builds: data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch builds'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
