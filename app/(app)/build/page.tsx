import BuilderClient from '@/components/builder/BuilderClient'
import { createClient } from '@/lib/supabase/server'

export default async function BuildPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, builds_used, builds_limit')
    .eq('id', user!.id)
    .single()

  const canBuild = profile?.plan !== 'free' || (profile?.builds_used ?? 0) < (profile?.builds_limit ?? 3)

  return <BuilderClient canBuild={canBuild} />
}
