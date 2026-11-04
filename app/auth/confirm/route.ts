import { NextRequest, NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase/server';
export async function GET(request: NextRequest) {
    const token_hash = request.nextUrl.searchParams.get('token_hash');
    const type = request.nextUrl.searchParams.get('type');
    if (token_hash && (type === 'invite' || type === 'recovery')) {
        const client = await serverClient();
        const { error } = await client.auth.verifyOtp({ token_hash, type });
        if (!error)
            return NextResponse.redirect(new URL('/login?set_password=1', request.url));
    }
    return NextResponse.redirect(new URL('/login?error=expired', request.url));
}
