import { redirect } from 'next/navigation';
import { configured, demoMode, serverClient } from '@/lib/supabase/server';
import Dashboard from '@/components/dashboard';
export const dynamic = 'force-dynamic';
export default async function Page() {
    if (demoMode())
        return <Dashboard demo email="本地演示"/>;
    if (!configured())
        return <main className="setup"><h1>OfferDesk</h1><h2>还差一步，连接你的工作台。</h2><p>请按照 README 配置 Supabase、视觉模型与环境变量。正式环境不会自动切换为演示模式。</p></main>;
    const supabase = await serverClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user)
        redirect('/login');
    return <Dashboard demo={false} email={user.email || '我的账户'}/>;
}
