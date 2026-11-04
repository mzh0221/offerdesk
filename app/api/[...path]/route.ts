import { NextRequest, NextResponse } from 'next/server';
import { adminClient, configured, demoMode, serverClient } from '@/lib/supabase/server';
import { importSchema, uploadsSchema, jobSchema } from '@/lib/schema';
import { looksLikeImage, nextAppliedDate, splitCities, validateImage } from '@/lib/domain';
import { extractJob } from '@/lib/vision';
import { z } from 'zod';
export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
class HttpError extends Error {
    constructor(public status: number, message: string) { super(message); }
}
function checked<T>(result: {
    data: T;
    error: {
        message: string;
    } | null;
}) { if (result.error)
    throw new HttpError(500, '数据操作失败，请重试'); return result.data; }
async function cleanup() {
    const admin = adminClient();
    const imports = checked(await admin.from('imports').select('id').lt('expires_at', new Date().toISOString()).order('expires_at').limit(50)) || [];
    let removed = 0;
    for (const item of imports) {
        const job = checked(await admin.from('jobs').select('id').eq('import_id', item.id).maybeSingle());
        if (job) {
            checked(await admin.from('imports').update({ expires_at: null }).eq('id', item.id));
            continue;
        }
        const files = checked(await admin.from('attachments').select('path').eq('import_id', item.id)) || [];
        if (files.length) {
            const result = await admin.storage.from('screenshots').remove(files.map(f => f.path));
            if (result.error)
                continue;
        }
        checked(await admin.from('imports').delete().eq('id', item.id));
        removed++;
    }
    return json({ removed });
}
async function handle(request: NextRequest, ctx: {
    params: Promise<{
        path: string[];
    }>;
}) {
    const started = Date.now();
    try {
        const { path } = await ctx.params;
        const [resource, id, action] = path;
        const method = request.method;
        if (resource === 'cleanup') {
            if (method !== 'GET' || !process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`)
                throw new HttpError(401, '未授权');
            return await cleanup();
        }
        if (method !== 'GET') {
            const origin = request.headers.get('origin');
            if (origin && origin !== request.nextUrl.origin)
                throw new HttpError(403, '请求来源无效');
        }
        if (!configured() || demoMode())
            throw new HttpError(503, '云端服务未启用，本地演示数据保存在浏览器');
        const client = await serverClient();
        const { data: { user } } = await client.auth.getUser();
        if (!user)
            throw new HttpError(401, '请先登录');
        if (id && !z.uuid().safeParse(id).success)
            throw new HttpError(400, '记录编号无效');
        async function ownedImport() { const data = checked(await client.from('imports').select('*').eq('id', id).eq('user_id', user!.id).maybeSingle()); if (!data)
            throw new HttpError(404, '导入记录不存在'); return data; }
        if (resource === 'imports' && !id && method === 'POST') {
            const input = importSchema.parse(await request.json());
            return json(checked(await client.from('imports').insert({ ...input, user_id: user.id }).select().single()), 201);
        }
        if (resource === 'imports' && id) {
            const item = await ownedImport();
            if (!action && method === 'GET') {
                const attachments = checked(await client.from('attachments').select('*').eq('import_id', id).order('position'));
                return json({ ...item, attachments });
            }
            if (action === 'uploads' && method === 'POST') {
                if (item.input_type !== 'images' || item.state === 'processing' || item.state === 'saved')
                    throw new HttpError(409, '当前导入不能上传图片');
                const { files } = uploadsSchema.parse(await request.json());
                const existing = checked(await client.from('attachments').select('id').eq('import_id', id));
                if (existing?.length)
                    throw new HttpError(409, '该导入已有图片，请重新创建导入');
                const admin = adminClient();
                const rows = files.map((file, position) => ({ id: crypto.randomUUID(), user_id: user.id, import_id: id, path: `${user.id}/${id}/${crypto.randomUUID()}`, position, ...file }));
                checked(await client.from('attachments').insert(rows));
                const uploads = [];
                for (const row of rows) {
                    const signed = checked(await admin.storage.from('screenshots').createSignedUploadUrl(row.path));
                    uploads.push({ ...row, token: signed!.token });
                }
                return json(uploads);
            }
            if (action === 'extract' && method === 'POST') {
                if (!process.env.DASHSCOPE_API_KEY)
                    throw new HttpError(503, '模型服务尚未配置，可先手动填写');
                const attachments = checked(await client.from('attachments').select('*').eq('import_id', id).order('position')) || [];
                if (item.input_type === 'images' && (!attachments.length || attachments.length > 5))
                    throw new HttpError(400, '请先上传1—5张同一岗位截图');
                if (item.input_type === 'text' && !item.raw_text.trim())
                    throw new HttpError(400, '请粘贴招聘原文');
                const images: string[] = [];
                for (const attachment of attachments) {
                    const file = checked(await client.storage.from('screenshots').download(attachment.path));
                    if (!file || validateImage(attachment.mime, file.size) || !looksLikeImage(new Uint8Array(await file.arrayBuffer()), attachment.mime))
                        throw new HttpError(400, '图片未上传完整或格式不正确，请重新上传');
                    images.push(checked(await client.storage.from('screenshots').createSignedUrl(attachment.path, 120))!.signedUrl);
                }
                const { data: attempt, error } = await client.rpc('begin_extraction', { target: id });
                if (error)
                    throw new HttpError(error.message.includes('QUOTA') ? 429 : 409, error.message.includes('QUOTA') ? '今日20次识别额度已用完，仍可手动录入' : error.message.includes('BUSY') ? '有识别任务正在运行，请稍候' : '该导入当前不可识别');
                try {
                    const result = await extractJob(item.input_type === 'text' ? item.raw_text : '', images);
                    const saved = checked(await client.from('imports').update({ state: 'ready', extracted: result, raw_text: result.raw_text, error: null, locked_until: null }).eq('id', id).eq('attempt_id', attempt).select().maybeSingle());
                    if (!saved)
                        throw new HttpError(409, '识别任务已被更新，请重新打开导入');
                    console.info(JSON.stringify({ event: 'extraction', ms: Date.now() - started, images: images.length, ok: true }));
                    return json(saved);
                }
                catch (error) {
                    await client.from('imports').update({ state: 'failed', error: error instanceof Error ? error.message : '识别失败', locked_until: null }).eq('id', id).eq('attempt_id', attempt);
                    throw error;
                }
            }
        }
        if (resource === 'attachments' && id && method === 'GET') {
            const item = checked(await client.from('attachments').select('*').eq('id', id).eq('user_id', user.id).maybeSingle());
            if (!item)
                throw new HttpError(404, '图片不存在');
            return json({ url: checked(await client.storage.from('screenshots').createSignedUrl(item.path, 300))!.signedUrl });
        }
        if (resource === 'jobs' && !id && method === 'GET') {
            const p = request.nextUrl.searchParams;
            const page = Math.max(1, Math.min(100000, Number(p.get('page')) || 1));
            let query = client.from('jobs').select('*', { count: 'exact' }).eq('user_id', user.id).order('updated_at', { ascending: false });
            // Fetch filtering data independently of pagination so filter choices stay stable.
            const facets = checked(await client.from('jobs').select('city,job_type,status').eq('user_id', user.id)) || [];
            const search = (p.get('q') || '').trim().slice(0, 100).replace(/[%_(),.\\]/g, '');
            if (search)
                query = query.ilike('search_text', `%${search}%`);
            const city = p.get('city');
            if (city) {
                const matchingCities = [...new Set(facets.map(f => f.city).filter((value): value is string => value !== null && splitCities(value).includes(city)))];
                if (!matchingCities.length)
                    return json({ items: [], total: 0, facets });
                query = query.in('city', matchingCities);
            }
            for (const field of ['status', 'job_type'])
                if (p.get(field))
                    query = query.eq(field, p.get(field)!);
            const result = await query.range((page - 1) * 20, page * 20 - 1);
            checked(result);
            return json({ items: result.data || [], total: result.count || 0, facets });
        }
        if (resource === 'jobs' && !id && method === 'POST') {
            const data = jobSchema.parse(await request.json());
            if (data.import_id) {
                const source = checked(await client.from('imports').select('id').eq('id', data.import_id).eq('user_id', user.id).maybeSingle());
                if (!source)
                    throw new HttpError(404, '导入不存在');
                const existing = checked(await client.from('jobs').select('*').eq('import_id', data.import_id).maybeSingle());
                if (existing)
                    return json(existing);
            }
            const { data: job, error } = await client.from('jobs').insert({ ...data, source_url: data.source_url || null, applied_at: nextAppliedDate(data.applied_at, data.status), user_id: user.id }).select().single();
            if (error?.code === '23505' && data.import_id)
                return json(checked(await client.from('jobs').select('*').eq('import_id', data.import_id).single()));
            checked({ data: job, error });
            if (data.import_id)
                await client.from('imports').update({ state: 'saved', expires_at: null }).eq('id', data.import_id);
            return json(job, 201);
        }
        if (resource === 'jobs' && id) {
            const job = checked(await client.from('jobs').select('*').eq('id', id).eq('user_id', user.id).maybeSingle());
            if (!job)
                throw new HttpError(404, '岗位不存在');
            if (method === 'GET') {
                const attachments = job.import_id ? checked(await client.from('attachments').select('*').eq('import_id', job.import_id).order('position')) : [];
                const source = job.import_id ? checked(await client.from('imports').select('raw_text').eq('id', job.import_id).maybeSingle()) : null;
                return json({ ...job, attachments, raw_text: source?.raw_text || '' });
            }
            if (method === 'PATCH') {
                const data = jobSchema.parse({ ...job, ...await request.json() });
                if (data.import_id !== job.import_id)
                    throw new HttpError(400, '不能修改岗位的来源记录');
                return json(checked(await client.from('jobs').update({ ...data, source_url: data.source_url || null, applied_at: nextAppliedDate(data.applied_at, data.status) }).eq('id', id).select().single()));
            }
            if (method === 'DELETE') {
                checked(await client.from('jobs').delete().eq('id', id));
                if (job.import_id) {
                    checked(await client.from('imports').update({ expires_at: new Date().toISOString(), state: 'failed', error: '关联岗位已删除，等待清理' }).eq('id', job.import_id));
                }
                return json({ ok: true });
            }
        }
        throw new HttpError(404, '接口不存在');
    }
    catch (error) {
        if (error instanceof z.ZodError)
            return json({ error: error.issues[0]?.message || '输入格式不正确' }, 400);
        if (error instanceof HttpError)
            return json({ error: error.message }, error.status);
        const message = error instanceof Error ? error.message : '请求失败';
        console.error(JSON.stringify({ event: 'api_error', ms: Date.now() - started, type: error instanceof Error ? error.name : 'unknown' }));
        return json({ error: message.includes('abort') || message.includes('timeout') ? '识别超时，可重试或手动填写' : message.startsWith('模型') || message.startsWith('识别') ? message : '服务暂时不可用，请稍后重试' }, 500);
    }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
