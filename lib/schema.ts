import { z } from 'zod';
import { STATUSES } from './domain.ts';
const nullableText = z.string().trim().max(2000).nullable();
const list = z.array(z.string().trim().min(1).max(2000)).max(40);
export const fieldsSchema = z.object({ company: z.string().trim().max(200), title: z.string().trim().max(200), city: nullableText, salary: nullableText, education: nullableText, graduation_year: nullableText, internship_duration: nullableText, days_per_week: nullableText, job_type: nullableText, required: list, preferred: list, availability: list, tags: z.array(z.string().trim().min(1).max(40)).max(15) });
export const jobSchema = fieldsSchema.extend({ company: z.string().trim().min(1, '请填写公司').max(200), title: z.string().trim().min(1, '请填写岗位').max(200), source_url: z.union([z.literal(''), z.url({ protocol: /^https?$/ })]).nullable(), notes: z.string().max(10000), status: z.enum(STATUSES), applied_at: z.iso.date().nullable(), import_id: z.uuid().nullable() });
export const importSchema = z.object({ input_type: z.enum(['images', 'text']), raw_text: z.string().max(30000).default('') });
// Optional additions keep drafts written by earlier versions readable.
export const draftSchema = importSchema.extend({
    source_url: z.string().max(2000).optional(),
    step: z.enum(['input', 'review']).optional(),
    additional_text: z.string().max(30000).optional(),
});
export const uploadsSchema = z.object({ files: z.array(z.object({ name: z.string().max(250), mime: z.enum(['image/jpeg', 'image/png', 'image/webp']), size: z.number().int().positive().max(5 * 1024 * 1024) })).min(1).max(5) });
