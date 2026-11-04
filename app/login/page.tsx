import { redirect } from 'next/navigation';
import { configured, demoMode } from '@/lib/supabase/server';
import LoginForm from '@/components/login-form';
export const dynamic = 'force-dynamic';
export default function Login() { if (demoMode() || !configured())
    redirect('/'); return <LoginForm />; }
