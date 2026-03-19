import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BuildResultClient from '@/components/builder/BuildResultClient'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ prompt?: string }>
}

export default async function BuildResultPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const { prompt } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch existing build
  const { data: build } = await supabase
    .from('builds')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!build) redirect('/dashboard')

  return (
    <BuildResultClient
      buildId={id}
      initialPrompt={prompt ?? build.prompt}
      initialOutput={build.output ?? ''}
      initialStatus={build.status}
    />
  )
}
