import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
export function configured() { return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY); }
export function demoMode() { return process.env.APP_MODE === 'demo' || (!configured() && process.env.NODE_ENV === 'development' && process.env.APP_MODE !== 'production'); }
export async function serverClient() {
    const store = await cookies();
    return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { getAll: () => store.getAll(), setAll: values => { try {
                values.forEach(({ name, value, options }) => store.set(name, value, options));
            }
            catch { /* Server components cannot set cookies; proxy refreshes them. */ } } } });
}
export function adminClient() {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
        throw new Error('服务端存储凭据尚未配置');
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}
