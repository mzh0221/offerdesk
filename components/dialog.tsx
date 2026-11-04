'use client';
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
export default function Dialog({ children, title, onClose, wide = false, drawer = false, expanded = false, footer }: {
    children: React.ReactNode;
    title: string;
    onClose: () => void;
    wide?: boolean;
    drawer?: boolean;
    expanded?: boolean;
    footer?: React.ReactNode;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const close = useRef(onClose);
    close.current = onClose;
    useEffect(() => { const previous = document.activeElement as HTMLElement; const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; ref.current?.focus(); function key(e: KeyboardEvent) { if (e.key === 'Escape')
        close.current(); if (e.key === 'Tab') {
        const items = ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]');
        if (!items?.length) {
            e.preventDefault();
            return;
        }
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) {
            e.preventDefault();
            last.focus();
        }
        else if (!e.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) {
            e.preventDefault();
            first.focus();
        }
    } } document.addEventListener('keydown', key); return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', key); previous?.focus(); }; }, []);
    return <div className={`overlay ${drawer ? 'drawer-overlay' : ''} ${expanded ? 'detail-overlay' : ''}`} onMouseDown={e => { if (e.target === e.currentTarget)
        onClose(); }}><div className={`dialog ${wide ? 'dialog-wide' : ''} ${drawer ? 'drawer' : ''} ${expanded ? 'detail-panel' : ''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}><header className="dialog-header"><h2>{title}</h2><button className="icon-button" aria-label="关闭" onClick={onClose}><X size={20}/></button></header>{children}{footer}</div></div>;
}
