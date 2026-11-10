import { useEffect, useRef, useState } from 'react';
import type { OcrRegion } from '@/lib/ocr-image';

export default function OcrCrop({ file, initial, onApply, onCancel }: {
    file: Blob; initial?: OcrRegion; onApply: (region: OcrRegion) => void; onCancel: () => void;
}) {
    const [url, setUrl] = useState('');
    const [region, setRegion] = useState<OcrRegion>(initial || { x: 0, y: 0, width: 1, height: 1 });
    const start = useRef<{ x: number; y: number } | null>(null);
    useEffect(() => { const value = URL.createObjectURL(file); setUrl(value); return () => URL.revokeObjectURL(value); }, [file]);
    function point(event: React.PointerEvent<HTMLDivElement>) {
        const box = event.currentTarget.getBoundingClientRect();
        return { x: Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)), y: Math.max(0, Math.min(1, (event.clientY - box.top) / box.height)) };
    }
    function move(event: React.PointerEvent<HTMLDivElement>) {
        if (!start.current) return;
        const end = point(event), from = start.current;
        setRegion({ x: Math.min(from.x, end.x), y: Math.min(from.y, end.y), width: Math.abs(end.x - from.x), height: Math.abs(end.y - from.y) });
    }
    const valid = region.width >= .01 && region.height >= .01 && region.x + region.width <= 1.000001 && region.y + region.height <= 1.000001;
    return <section className="ocr-crop" aria-label="选择识别区域">
        <h3>框选需要识别的招聘信息</h3><p>拖动框选，避开浏览器栏、导航和侧边推荐。原始截图仍完整保留。</p>
        <div className="crop-stage" onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); start.current = point(event); }} onPointerMove={move}
            onPointerUp={event => { move(event); start.current = null; }} onPointerCancel={() => { start.current = null; }}>
            <img src={url} alt="待框选的原始截图" draggable={false}/>
            <div className="crop-rectangle" style={{ left: `${region.x * 100}%`, top: `${region.y * 100}%`, width: `${region.width * 100}%`, height: `${region.height * 100}%` }}/>
        </div>
        <div className="crop-inputs">{([['x', '左侧'], ['y', '顶部'], ['width', '宽度'], ['height', '高度']] as const).map(([key, label]) => <label key={key}>{label}（%）<input type="number" min={key === 'x' || key === 'y' ? 0 : 1} max={100} step={1} value={Math.round(region[key] * 100)} onChange={e => setRegion({ ...region, [key]: Number(e.target.value) / 100 })}/></label>)}</div>
        {!valid && <p role="alert">请选择完整且不小于 1% 的区域。</p>}
        <div className="dialog-actions"><button type="button" className="secondary" onClick={onCancel}>取消框选</button><button type="button" className="secondary" onClick={() => setRegion({ x: 0, y: 0, width: 1, height: 1 })}>恢复整图</button><button type="button" className="primary" disabled={!valid} onClick={() => onApply(region)}>应用识别区域</button></div>
    </section>;
}
