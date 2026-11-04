import { ExternalLink } from 'lucide-react';
import { safeSourceUrl } from '@/lib/domain';

export default function RecruitmentLink({ url, compact = false, jobTitle = '' }: {
    url: string | null;
    compact?: boolean;
    jobTitle?: string;
}) {
    const href = safeSourceUrl(url);
    if (compact) {
        return href
            ? <a className="recruitment-row-link" href={href} target="_blank" rel="noopener noreferrer" title={href} aria-label={`打开${jobTitle}招聘原页（新标签页）`}>招聘原页<ExternalLink size={14}/></a>
            : <span className="missing-recruitment-link">未添加链接</span>;
    }
    return <div className="recruitment-address">
        <span>招聘网址</span>
        {href
            ? <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`打开${jobTitle}招聘原页（新标签页）`}><span>{href}</span><ExternalLink size={17}/></a>
            : <p>未添加招聘网址，可通过“编辑信息”补充。</p>}
    </div>;
}
