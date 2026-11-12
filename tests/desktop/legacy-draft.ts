import type { Page } from '@playwright/test';

// Emulate records written by versions that still offered direct text entry.
export async function addLegacyTextDraft(page: Page, rawText: string) {
    await page.getByRole('heading', { name: '岗位与投递', exact: true }).waitFor();
    await page.evaluate(raw => new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('offerdesk-local-v1', 1);
        request.onerror = () => reject(request.error);
        request.onupgradeneeded = () => request.result.createObjectStore('records', { keyPath: 'id' });
        request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction('records', 'readwrite');
            tx.objectStore('records').put({ id: crypto.randomUUID(), kind: 'import', state: 'uploaded', input_type: 'text', raw_text: raw, extracted: null, created_at: '2026-01-01T00:00:00Z' });
            tx.oncomplete = () => { db.close(); resolve(); };
            tx.onabort = () => { db.close(); reject(tx.error); };
        };
    }), rawText);
    await page.reload();
}
