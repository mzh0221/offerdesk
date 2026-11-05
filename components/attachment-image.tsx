import { useEffect, useState } from 'react';
import type { Attachment } from '@/lib/domain';
import { localClient as api } from '@/lib/local-client';
export default function AttachmentImage({ item }: {
    item: Attachment;
}) {
    const [url, setUrl] = useState('');
    const [error, setError] = useState(false);
    useEffect(() => { let active = true; let objectUrl = ''; api.image(item.id).then(value => { objectUrl = value; if (active)
        setUrl(value); }).catch(() => setError(true)); return () => { active = false; if (objectUrl.startsWith('blob:'))
        URL.revokeObjectURL(objectUrl); }; }, [item.id]);
    return <figure className="source-image">{url ? <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={item.name} onError={() => setError(true)}/></a> : <div className="image-placeholder">{error ? '图片无法载入，请重新打开详情' : '正在读取原图…'}</div>}<figcaption>{item.name}</figcaption></figure>;
}
