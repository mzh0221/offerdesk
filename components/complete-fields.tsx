import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { type Fields } from '@/lib/domain';
import { completeJobFields, completionMessage } from '@/lib/complete-fields';

export default function CompleteFields({ value, rawText, onChange }: { value: Fields; rawText: string; onChange: (value: Fields) => void }) {
    const [message, setMessage] = useState('');
    if (!rawText.trim()) return null;
    return <div className="field-completion">
        <button type="button" className="secondary" onClick={() => {
            const result = completeJobFields(value, rawText);
            onChange(result.fields);
            setMessage([completionMessage(result.filledFields), ...result.warnings].join(' '));
        }}><Sparkles size={15}/>从原文补全</button>
        <p className="form-help">补充空字段和遗漏条目，保留已填内容。仅依据已保存原文，不会重新访问网页。</p>
        {message && <p className="form-help" role="status">{message}</p>}
    </div>;
}
