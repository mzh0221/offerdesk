import { z } from 'zod';
import { EMPTY_FIELDS } from './domain.ts';
import { fieldsSchema } from './schema.ts';

export const externalBatchSchema = z.object({
    batch_id: z.string().trim().min(1).max(200),
    jobs: z.array(z.unknown()).min(1).max(50),
});
const sourceUrl = z.string().trim().min(1).max(2000).refine(value => {
    try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password; }
    catch { return false; }
}, '来源链接必须为不含凭据的 HTTP(S) 地址');
export const externalJobSchema = z.object({
    source: z.string().trim().min(1).max(200),
    source_url: sourceUrl,
    raw_text: z.string().trim().min(1).max(30000),
    fields: z.preprocess(value => ({ ...EMPTY_FIELDS, ...(value && typeof value === 'object' && !Array.isArray(value) ? value : {}) }),
        fieldsSchema.extend({ company: z.string().trim().min(1).max(200), title: z.string().trim().min(1).max(200) })),
});
export function normalizeSourceUrl(value: string): string {
    const url = new URL(value);
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
        if (/^utm_/i.test(key) || ['gclid', 'fbclid', 'msclkid'].includes(key.toLowerCase())) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    return url.href;
}
export type ExternalImportResult = { index: number; status: 'created' | 'duplicate' | 'invalid'; draft_id?: string; record_id?: string; error?: string };
