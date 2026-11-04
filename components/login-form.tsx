'use client';
import { useEffect, useState } from 'react';
import { ArrowUpRight, BriefcaseBusiness, LoaderCircle, CheckCircle2 } from 'lucide-react';
import { browserClient } from '@/lib/supabase/browser';
export default function Login() {
    const [mode, setMode] = useState<'login' | 'reset' | 'set'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    useEffect(() => { const url = new URL(location.href); if (url.searchParams.has('set_password'))
        setMode('set'); if (url.searchParams.has('error'))
        setMessage('链接已失效，请联系维护者重新邀请，或重置密码。'); if (location.hash.includes('access_token') || location.hash.includes('error')) {
        const client = browserClient();
        client.auth.getSession().then(({ data, error }) => { if (error || !data.session)
            setMessage('链接无效或已过期，请重新获取。');
        else
            setMode('set'); });
    } const { data: { subscription } } = browserClient().auth.onAuthStateChange(event => { if (event === 'PASSWORD_RECOVERY')
        setMode('set'); }); return () => subscription.unsubscribe(); }, []);
    async function submit(e: React.FormEvent) { e.preventDefault(); setBusy(true); setMessage(''); try {
        const client = browserClient();
        if (mode === 'reset') {
            const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/login?set_password=1` });
            if (error)
                throw error;
            setMessage('若该邮箱已受邀，密码重置邮件将发送到你的邮箱。');
        }
        else if (mode === 'set') {
            const { error } = await client.auth.updateUser({ password });
            if (error)
                throw error;
            location.assign('/');
        }
        else {
            const { error } = await client.auth.signInWithPassword({ email, password });
            if (error)
                throw error;
            location.assign('/');
        }
    }
    catch {
        setMessage(mode === 'login' ? '登录失败，请检查邮箱和密码；此工作台仅接受邀请用户。' : '操作未完成，请确认链接有效或稍后重试。');
    }
    finally {
        setBusy(false);
    } }
    return <main className="login-layout"><section className="login-story"><div className="brand"><span className="brand-icon"><BriefcaseBusiness size={22}/></span>OfferDesk<span className="brand-dot">.</span></div><div><span className="eyebrow">YOUR NEXT CHAPTER</span><h1>让每一次投递，<br />都有迹可循。</h1><p>收集心仪岗位，理清招聘要求。<br />把精力留给准备，把进度交给工作台。</p></div><span className="story-footer">少一点杂乱，多一点笃定。<ArrowUpRight size={20}/></span></section><section className="login-form"><div><span className="mini-icon"><CheckCircle2 size={22}/></span><h2>{mode === 'set' ? '设置你的密码' : mode === 'reset' ? '找回密码' : '欢迎回到工作台'}</h2><p className="muted">{mode === 'set' ? '设置至少 8 位密码，开始整理你的求职旅程。' : '供你和受邀同学使用的私人岗位空间。'}</p><form onSubmit={submit}>{mode !== 'set' && <label>邮箱<input autoComplete="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"/></label>}{mode !== 'reset' && <label>密码<input autoComplete={mode === 'set' ? 'new-password' : 'current-password'} type="password" minLength={8} required value={password} onChange={e => setPassword(e.target.value)} placeholder="输入密码"/></label>}{message && <p className="notice" role="status">{message}</p>}<button className="primary full" disabled={busy}>{busy ? <LoaderCircle className="spin" size={16}/> : null}{mode === 'set' ? '设置密码并进入' : mode === 'reset' ? '发送重置邮件' : '进入工作台'}<ArrowUpRight size={16}/></button></form><button className="text-button" onClick={() => { setMode(mode === 'reset' ? 'login' : 'reset'); setMessage(''); }}>{mode === 'reset' ? '返回登录' : '忘记密码？'}</button><p className="login-foot">邀请制开放 · 你的岗位和截图仅自己可见</p></div></section></main>;
}
