export const STATUSES = ['待投递', '已投递', '笔试', '面试', '已结束'] as const;
export type Status = typeof STATUSES[number];
export type Fields = {
    company: string;
    title: string;
    city: string | null;
    salary: string | null;
    education: string | null;
    graduation_year: string | null;
    internship_duration: string | null;
    days_per_week: string | null;
    job_type: string | null;
    required: string[];
    preferred: string[];
    availability: string[];
    tags: string[];
};
export type Job = Fields & {
    id: string;
    user_id?: string;
    import_id: string | null;
    source_url: string | null;
    status: Status;
    applied_at: string | null;
    notes: string;
    created_at: string;
    updated_at: string;
    is_sample?: boolean;
    is_reference?: boolean;
    source_checked_at?: string;
};
export type Extraction = Fields & {
    raw_text: string;
    warnings: string[];
};
export type ImportRecord = {
    id: string;
    input_type: 'images' | 'text';
    raw_text: string;
    state: 'uploaded' | 'processing' | 'ready' | 'failed' | 'saved';
    extracted: Extraction | null;
    error: string | null;
    created_at: string;
};
export type Attachment = {
    id: string;
    import_id: string;
    path: string;
    name: string;
    mime: string;
    size: number;
    position: number;
    url?: string;
};
export const EMPTY_FIELDS: Fields = { company: '', title: '', city: null, salary: null, education: null, graduation_year: null, internship_duration: null, days_per_week: null, job_type: null, required: [], preferred: [], availability: [], tags: [] };
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export function validateImage(mime: string, bytes: number) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime))
        return '仅支持 JPG、PNG、WebP 图片';
    if (bytes <= 0 || bytes > MAX_IMAGE_BYTES)
        return '每张图片需大于 0 且不超过 5MB';
    return null;
}
export function todayShanghai(now = new Date()) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now); }
export function nextAppliedDate(previous: string | null, status: Status, now = new Date()) { return previous || (status === '待投递' ? null : todayShanghai(now)); }
export function safeSourceUrl(value: string | null | undefined) {
    if (!value?.trim())
        return null;
    try {
        const url = new URL(value);
        return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
    }
    catch {
        return null;
    }
}
export function splitCities(value: string | null | undefined): string[] {
    return [...new Set((value || '').split(/[/／、,，;；|｜]+/).map(city => city.trim()).filter(Boolean))];
}
export function filterJobs(jobs: Job[], search: string, city: string, status: string, type = '') {
    const query = search.trim().toLocaleLowerCase();
    return jobs.filter(j => (!query || [j.company, j.title, ...j.tags].join(' ').toLocaleLowerCase().includes(query)) && (!city || splitCities(j.city).includes(city)) && (!status || j.status === status) && (!type || j.job_type === type)).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}
export function looksLikeImage(bytes: Uint8Array, mime: string) {
    return mime === 'image/png' ? [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b)
        : mime === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
            : mime === 'image/webp' ? String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP' : false;
}
