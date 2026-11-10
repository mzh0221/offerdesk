import { useEffect } from 'react';

/** Protect native window close/reload as well as the in-app close actions. */
export function useUnsavedChanges(dirty: boolean) {
    useEffect(() => {
        if (!dirty) return;
        const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
        window.addEventListener('beforeunload', prevent);
        return () => window.removeEventListener('beforeunload', prevent);
    }, [dirty]);
}
