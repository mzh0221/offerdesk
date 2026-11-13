import { externalBatchSchema, externalJobSchema, normalizeSourceUrl, type ExternalImportResult } from './external-import';
import { filterJobs, nextAppliedDate, type Job } from './domain';
import { fieldsSchema, importSchema, draftSchema, jobSchema } from './schema';
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
// All related rows commit together; a failed write leaves the previous draft intact.
async function writeRows<T>(run: (store: IDBObjectStore, rows: Row[], result: (value: T) => void) => void): Promise<T> {
    const db = await database();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('records', 'readwrite');
        let value: T;
        let failure: unknown;
        tx.oncomplete = () => { db.close(); resolve(value); };
        tx.onabort = () => { db.close(); reject(failure || new Error('保存失败，可能是本地存储空间不足')); };
        const store = tx.objectStore('records');
        // Read and mutate in the same transaction, including lookup-dependent deletes.
        const request = store.getAll();
        request.onsuccess = () => {
            try { run(store, request.result, next => { value = next; }); } catch (error) { failure = error; tx.abort(); }
        };
    });
}
const orderedAttachments = (rows: Row[], importId: unknown) => rows.filter(row => row.kind === 'attachment' && row.import_id === importId).sort((a, b) => Number(a.position) - Number(b.position) || a.id.localeCompare(b.id));

export async function saveImportDraft(id: string | null, body: Record<string, unknown>, files?: File[]) {
    const data = { ...draftSchema.parse(body), extracted: fieldsSchema.parse(body.extracted) };
    return writeRows<Row>((store, rows, result) => {
        const item = id ? rows.find(row => row.id === id && row.kind === 'import') : undefined;
        if (id && !item) throw new Error('导入不存在');
        if (item?.state === 'saved' || (id !== null && rows.some(row => row.kind === 'job' && row.import_id === id))) throw new Error('该导入已保存，请在岗位详情中修改');
        const record = { ...item, ...data, id: id || crypto.randomUUID(), kind: 'import', state: 'review', updated_at: new Date().toISOString(), created_at: item?.created_at || new Date().toISOString() };
        store.put(record);
        if (files !== undefined) {
            for (const row of orderedAttachments(rows, record.id)) store.delete(row.id);
            files.forEach((file, position) => {
                const attachmentId = crypto.randomUUID();
                store.put({ id: attachmentId, path: attachmentId, kind: 'attachment', import_id: record.id, name: file.name, mime: file.type, size: file.size, position, blob: file });
            });
        }
        result(record);
    });
}
export async function getScreenshotUrl(id: string) { const row = await get(id); if (!row?.blob)
    throw new Error('截图不存在'); return URL.createObjectURL(row.blob as Blob); }
export async function getScreenshotFile(id: string) {
    const row = await get(id);
    if (!row?.blob) throw new Error('截图不存在');
    return new File([row.blob as Blob], String(row.name), { type: String(row.mime) });
}
// Opening the app must not insert demo or reference jobs into a new user's library.
export async function initializeLocalStore(): Promise<void> {}
export async function localRequest(path: string, method = 'GET', body?: Record<string, unknown>): Promise<any> {
    const url = new URL(path, 'http://local');
    const [resource, id] = url.pathname.split('/').filter(Boolean);
    const rows = await all();
    if (resource === 'imports' && !id && method === 'GET') {
        return rows.filter(row => row.kind === 'import' && row.state !== 'saved' && !rows.some(job => job.kind === 'job' && job.import_id === row.id))
            .sort((a, b) => String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at)));
    }
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
        const imported = body?.import_id ? rows.find(row => row.id === body.import_id) : undefined;
        const job = { external_key: imported?.external_key, ...jobSchema.parse(body), id: body?.import_id ? `job-${body.import_id}` : crypto.randomUUID(), kind: 'job', created_at: now, updated_at: now, applied_at: nextAppliedDate(body?.applied_at as string | null, body?.status as Job['status']) };
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
            return { ...job, raw_text: rows.find(r => r.id === job.import_id)?.raw_text || '', attachments: orderedAttachments(rows, job.import_id) };
        if (method === 'PATCH') {
            const merged: Row = { ...job, ...jobSchema.parse({ ...job, ...body }), id, kind: 'job', updated_at: new Date().toISOString() };
            merged.applied_at = nextAppliedDate(merged.applied_at as string | null, merged.status as Job['status']);
            await put(merged);
            return merged;
        }
        if (method === 'DELETE') {
            await writeRows<void>((store, current, result) => {
                const target = current.find(row => row.id === id && row.kind === 'job');
                if (!target) throw new Error('岗位不存在');
                store.delete(id);
                if (target.import_id) {
                    for (const row of current.filter(row => row.id === target.import_id || row.import_id === target.import_id)) store.delete(row.id);
                }
                result(undefined);
            });
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
        if (item.kind !== 'import') throw new Error('导入不存在');
        if (method === 'DELETE') {
            await writeRows<void>((store, current, result) => {
                if (current.some(row => row.kind === 'job' && row.import_id === id)) throw new Error('该草稿已保存为岗位，不能丢弃');
                store.delete(id);
                for (const attachment of orderedAttachments(current, id)) store.delete(attachment.id);
                result(undefined);
            });
            return { ok: true };
        }
        if (method === 'PATCH') {
            const updated = { ...item, raw_text: importSchema.parse({ input_type: item.input_type, raw_text: body?.raw_text }).raw_text, extracted: fieldsSchema.parse(body?.extracted), state: item.state === 'saved' ? 'saved' : 'review' };
            await put(updated);
            return updated;
        }
        return { ...item, attachments: orderedAttachments(rows, id) };
    }
    throw new Error('未找到记录');
}

// Validation precedes a single transaction so concurrent clients cannot create duplicates.
export async function importExternalJobs(body: unknown) {
    const batch = externalBatchSchema.parse(body);
    const fingerprint = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(batch))))).map(b => b.toString(16).padStart(2, '0')).join('');
    const parsed = batch.jobs.map(item => externalJobSchema.safeParse(item));
    return writeRows<{ batch_id: string; results: ExternalImportResult[] }>((store, rows, result) => {
        const receipt = rows.find(row => row.kind === 'external-batch' && row.batch_id === batch.batch_id);
        if (receipt) {
            if (receipt.fingerprint !== fingerprint) throw new Error('批次标识已使用，重试必须保持内容一致；新内容请使用新批次标识');
            result(receipt.response as { batch_id: string; results: ExternalImportResult[] }); return;
        }
        const results: ExternalImportResult[] = [];
        parsed.forEach((parsedJob, index) => {
            if (!parsedJob.success) {
                results.push({ index, status: 'invalid', error: parsedJob.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ') });
                return;
            }
            const job = parsedJob.data;
            const key = normalizeSourceUrl(job.source_url);
            const existing = rows.find(row => {
                if (row.kind !== 'job' && row.kind !== 'import') return false;
                if (row.external_key === key) return true;
                if (typeof row.source_url !== 'string' || !row.source_url) return false;
                try { return normalizeSourceUrl(row.source_url) === key; } catch { return false; }
            });
            if (existing) {
                results.push({ index, status: 'duplicate', record_id: existing.id, ...(existing.kind === 'import' && existing.state !== 'saved' ? { draft_id: existing.id } : {}) });
                return;
            }
            const now = new Date().toISOString();
            const row: Row = { id: crypto.randomUUID(), kind: 'import', input_type: 'text', state: 'review', step: 'review',
                raw_text: job.raw_text, source_url: job.source_url, extracted: job.fields,
                external_source: job.source, external_batch_id: batch.batch_id, external_key: key,
                created_at: now, updated_at: now };
            store.put(row); rows.push(row);
            results.push({ index, status: 'created', draft_id: row.id,
                ...(job.filled_fields.length ? { filled_fields: job.filled_fields } : {}),
                ...(job.warnings.length ? { warnings: job.warnings } : {}) });
        });
        const response = { batch_id: batch.batch_id, results };
        store.put({ id: crypto.randomUUID(), kind: 'external-batch', batch_id: batch.batch_id, fingerprint, response });
        result(response);
    });
}
