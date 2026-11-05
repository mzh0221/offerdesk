import { filterJobs, nextAppliedDate, type Job } from './domain';
import { seedReferenceJobs } from './reference-jobs';
import { importSchema, jobSchema } from './schema';
type Row = {
    id: string;
    kind: string;
    [key: string]: unknown;
};
function database(): Promise<IDBDatabase> { return new Promise((resolve, reject) => { const request = indexedDB.open('offerdesk-local-v1', 1); request.onupgradeneeded = () => request.result.createObjectStore('records', { keyPath: 'id' }); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(new Error('本地数据存储不可用，请重新打开应用')); }); }
async function records<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> { const db = await database(); return new Promise((resolve, reject) => { const tx = db.transaction('records', mode); const request = run(tx.objectStore('records')); let value: T; request.onsuccess = () => { value = request.result; }; tx.oncomplete = () => { db.close(); resolve(value); }; tx.onerror = () => { db.close(); reject(new Error('保存失败，可能是本地存储空间不足')); }; }); }
const all = () => records<Row[]>('readonly', s => s.getAll());
const put = (row: unknown) => records('readwrite', s => s.put(row));
const get = (id: string) => records<Row | undefined>('readonly', s => s.get(id));
const del = (id: string) => records('readwrite', s => s.delete(id));
export async function saveScreenshots(importId: string, files: File[]) { for (const [position, file] of files.entries()) {
    const id = crypto.randomUUID();
    await put({ id, kind: 'attachment', import_id: importId, path: id, name: file.name, mime: file.type, size: file.size, position, blob: file });
} }
export async function getScreenshotUrl(id: string) { const row = await get(id); if (!row?.blob)
    throw new Error('截图不存在'); return URL.createObjectURL(row.blob as Blob); }
let seedTask: Promise<void> | null = null;
export function initializeLocalStore(): Promise<void> {
    if (seedTask) return seedTask;
    seedTask = (async () => {
        await seedReferenceJobs(await all(), put, del);
    })().catch(error => { seedTask = null; throw error; });
    return seedTask;
}
export async function localRequest(path: string, method = 'GET', body?: Record<string, unknown>): Promise<any> {
    const url = new URL(path, 'http://local');
    const [resource, id] = url.pathname.split('/').filter(Boolean);
    const rows = await all();
    if (resource === 'jobs' && !id && method === 'GET') {
        const jobs = rows.filter(r => r.kind === 'job') as unknown as Job[];
        const p = url.searchParams;
        const filtered = filterJobs(jobs, p.get('q') || '', p.get('city') || '', p.get('status') || '', p.get('job_type') || '');
        const page = Number(p.get('page')) || 1;
        return { items: filtered.slice((page - 1) * 20, page * 20), total: filtered.length, facets: jobs };
    }
    if (resource === 'jobs' && method === 'POST') {
        const existing = rows.find(r => body?.import_id && r.kind === 'job' && r.import_id === body.import_id);
        if (existing)
            return existing;
        const now = new Date().toISOString();
        const job = { ...jobSchema.parse(body), id: body?.import_id ? `job-${body.import_id}` : crypto.randomUUID(), kind: 'job', created_at: now, updated_at: now, applied_at: nextAppliedDate(body?.applied_at as string | null, body?.status as Job['status']) };
        await put(job);
        if (body?.import_id) {
            const item = await get(body.import_id as string);
            if (item)
                await put({ ...item, state: 'saved' });
        }
        return job;
    }
    if (resource === 'jobs' && id) {
        const job = await get(id);
        if (!job)
            throw new Error('岗位不存在');
        if (method === 'GET')
            return { ...job, raw_text: rows.find(r => r.id === job.import_id)?.raw_text || '', attachments: rows.filter(r => r.kind === 'attachment' && r.import_id === job.import_id) };
        if (method === 'PATCH') {
            const merged: Row = { ...job, ...jobSchema.parse({ ...job, ...body }), id, kind: 'job', updated_at: new Date().toISOString() };
            merged.applied_at = nextAppliedDate(merged.applied_at as string | null, merged.status as Job['status']);
            await put(merged);
            return merged;
        }
        if (method === 'DELETE') {
            await del(id);
            if (job.import_id) {
                for (const row of rows.filter(r => r.import_id === job.import_id))
                    await del(row.id);
                await del(job.import_id as string);
            }
            return { ok: true };
        }
    }
    if (resource === 'imports' && method === 'POST' && !id) {
        const record = { ...importSchema.parse(body), id: crypto.randomUUID(), kind: 'import', state: 'uploaded', extracted: null, error: null, created_at: new Date().toISOString() };
        await put(record);
        return record;
    }
    if (resource === 'imports' && id) {
        const item = await get(id);
        if (!item)
            throw new Error('导入不存在');
        return { ...item, attachments: rows.filter(r => r.kind === 'attachment' && r.import_id === id) };
    }
    throw new Error('未找到记录');
}
