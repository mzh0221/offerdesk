import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'OfferDesk · 岗位投递台', description: '截图收集岗位，整理要求，清楚记录每一次投递。', robots: { index: false, follow: false } };
export default function Layout({ children }: {
    children: React.ReactNode;
}) { return <html lang="zh-CN"><body>{children}</body></html>; }
