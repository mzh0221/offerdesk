'use client';
import { RotateCcw } from 'lucide-react';
export default function ErrorPage({ reset }: { reset: () => void }) {
    return <main className="setup"><h1>OfferDesk.</h1><h2>工作台暂时未能载入。</h2><p>你的已保存记录不会因此丢失。请稍后重试；如果持续出现，请联系维护者检查服务配置。</p><button className="primary" style={{ marginTop: 22 }} onClick={reset}><RotateCcw size={16}/>重新载入</button></main>;
}
