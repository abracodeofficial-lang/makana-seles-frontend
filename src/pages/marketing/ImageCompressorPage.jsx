import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Download, ImagePlus, Trash2, Eye, RefreshCw, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { PageHeader } from '../../components/layout/Layout';
import { Btn, Card, Modal, Select } from '../../components/ui';
import { compressToWebp, downloadBlob, formatBytes, makeZip, supportsWebpEncode, webpName } from '../../lib/imageCompress';

const TARGETS  = [100, 150, 200, 300, 500];
const MAX_SIDES = [
  { value: 'orig', label: 'نفس الأبعاد الأصلية' },
  { value: '3840', label: '3840 بكسل (4K)' },
  { value: '2560', label: '2560 بكسل' },
  { value: '1920', label: '1920 بكسل (Full HD)' },
  { value: '1600', label: '1600 بكسل' },
  { value: '1200', label: '1200 بكسل' },
];
const QUALITY_FLOORS = [
  { value: '0.8', label: 'عالية جداً (80%+)' },
  { value: '0.7', label: 'عالية (70%+) — موصى' },
  { value: '0.6', label: 'متوازنة (60%+)' },
];
const MAX_FILES = 100;

let seq = 0;

export default function ImageCompressorPage() {
  const [items, setItems]       = useState([]);
  const [targetKb, setTargetKb] = useState('200');
  const [maxSide, setMaxSide]   = useState('orig');
  const [minQ, setMinQ]         = useState('0.7');
  const [dragging, setDragging] = useState(false);
  const [compare, setCompare]   = useState(null);
  const [zipping, setZipping]   = useState(false);
  const [noWebp, setNoWebp]     = useState(false);
  const inputRef  = useRef(null);
  const busyRef   = useRef(false);
  const itemsRef  = useRef(items);
  const settingsRef = useRef({ targetKb, maxSide, minQ });
  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => { settingsRef.current = { targetKb, maxSide, minQ }; }, [targetKb, maxSide, minQ]);

  useEffect(() => { supportsWebpEncode().then(ok => setNoWebp(!ok)); }, []);

  // تنظيف روابط المعاينة عند الخروج من الصفحة
  useEffect(() => () => itemsRef.current.forEach(revoke), []);

  const patch = (id, data) => setItems(list => list.map(i => (i.id === id ? { ...i, ...data } : i)));

  // طابور: صورة ورا صورة حتى ما يعلق المتصفح
  const runQueue = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      for (;;) {
        const next = itemsRef.current.find(i => i.status === 'waiting');
        if (!next) break;
        patch(next.id, { status: 'working' });
        const s = settingsRef.current;
        try {
          const r = await compressToWebp(next.file, {
            targetBytes: Number(s.targetKb) * 1024,
            maxSide: s.maxSide && s.maxSide !== 'orig' ? Number(s.maxSide) : null,
            minQuality: Number(s.minQ),
          });
          const current = itemsRef.current.find(i => i.id === next.id);
          if (!current) continue;                         // انحذفت أثناء الضغط
          if (current.outUrl) URL.revokeObjectURL(current.outUrl);
          patch(next.id, { status: 'done', result: r, outUrl: URL.createObjectURL(r.blob), error: null });
        } catch {
          patch(next.id, { status: 'error', error: 'المتصفح ما قدر يفتح هالصورة' });
        }
        await new Promise(r => setTimeout(r, 0));          // نعطي الواجهة نفَس
      }
    } finally { busyRef.current = false; }
  };

  useEffect(() => { if (items.some(i => i.status === 'waiting')) runQueue(); }, [items]);   // eslint-disable-line react-hooks/exhaustive-deps

  const addFiles = (fileList) => {
    const all = Array.from(fileList || []);
    const images = all.filter(f => f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif|tiff?|svg)$/i.test(f.name));
    if (images.length < all.length) toast.error(`تجاهلنا ${all.length - images.length} ملف مش صورة`);
    const room = MAX_FILES - itemsRef.current.length;
    if (images.length > room) toast.error(`الحد ${MAX_FILES} صورة بالمرة الواحدة`);
    const fresh = images.slice(0, Math.max(0, room)).map(file => ({
      id: ++seq, file, name: webpName(file.name), origUrl: URL.createObjectURL(file),
      status: 'waiting', result: null, outUrl: null, error: null,
    }));
    if (fresh.length) setItems(list => [...list, ...fresh]);
  };

  const recompressAll = () => setItems(list => list.map(i => ({ ...i, status: 'waiting' })));
  const remove = (id) => setItems(list => { const it = list.find(i => i.id === id); if (it) revoke(it); return list.filter(i => i.id !== id); });
  const clearAll = () => { items.forEach(revoke); setItems([]); };

  const done = items.filter(i => i.status === 'done');
  const working = items.some(i => i.status === 'waiting' || i.status === 'working');
  const totalIn  = done.reduce((s, i) => s + i.file.size, 0);
  const totalOut = done.reduce((s, i) => s + i.result.blob.size, 0);

  const downloadAll = async () => {
    if (!done.length) return;
    if (done.length === 1) { downloadBlob(done[0].result.blob, done[0].name); return; }
    setZipping(true);
    try {
      const used = new Map();
      const files = done.map(i => {   // أسماء مكررة ← نضيف رقم
        const n = used.get(i.name) || 0;
        used.set(i.name, n + 1);
        return { name: n ? i.name.replace(/\.webp$/, `-${n + 1}.webp`) : i.name, blob: i.result.blob };
      });
      downloadBlob(await makeZip(files), `images-webp-${new Date().toISOString().slice(0, 10)}.zip`);
    } catch { toast.error('فشل تجهيز الملف'); }
    finally { setZipping(false); }
  };

  return (
    <div className="font-[Cairo]" dir="rtl">
      <PageHeader title="ضغط الصور" subtitle="تحويل أي صورة لـ WebP بحجم صغير وبدون ما يتغير شكلها"
        actions={done.length > 0 && (
          <Btn onClick={downloadAll} loading={zipping} disabled={working}>
            <Download size={14} /> {done.length > 1 ? `تحميل الكل (${done.length}) ZIP` : 'تحميل'}
          </Btn>
        )} />

      <div className="p-4 sm:p-6 space-y-4">
        {noWebp && (
          <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 text-sm text-gray-200">
            <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
            هالمتصفح ما بيدعم إنشاء WebP. افتح الصفحة من Chrome أو Edge أو Firefox.
          </div>
        )}

        <Card>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select label="الحجم الأقصى لكل صورة" clearable={false} value={targetKb} onChange={e => setTargetKb(e.target.value)}
              options={TARGETS.map(t => ({ value: String(t), label: `أقل من ${t} KB` }))} />
            <Select label="الأبعاد" clearable={false} value={maxSide} onChange={e => setMaxSide(e.target.value)}
              options={MAX_SIDES} />
            <Select label="حماية الجودة" clearable={false} value={minQ} onChange={e => setMinQ(e.target.value)}
              options={QUALITY_FLOORS} />
          </div>
          <div className="px-4 pb-4 flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span>نسبة الطول للعرض ما بتتغير أبداً. إذا ما وصلت الصورة للحجم بالجودة المحددة، بتنصغّر أبعادها شوي بنفس النسبة.</span>
            {items.length > 0 && (
              <Btn size="sm" variant="outline" className="ms-auto" onClick={recompressAll} disabled={working}>
                <RefreshCw size={13} /> طبّق الإعدادات على كل الصور
              </Btn>
            )}
          </div>
        </Card>

        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
          className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors
            ${dragging ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700 hover:border-gray-500 bg-gray-800/40'}`}>
          <ImagePlus size={32} className="mx-auto mb-2 text-blue-400" />
          <p className="font-semibold text-gray-200">اسحب الصور هون أو اضغط لتختار</p>
          <p className="text-xs text-gray-500 mt-1">PNG · JPG · WebP · GIF · BMP · AVIF — لحد {MAX_FILES} صورة بالمرة</p>
          <input ref={inputRef} type="file" accept="image/*" multiple hidden
            onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
        </div>

        {items.length > 0 && (
          <Card>
            <div className="flex flex-wrap items-center gap-3 p-3 border-b border-gray-700 text-sm">
              <span className="text-gray-300">{done.length} من {items.length} جاهزة</span>
              {done.length > 0 && (
                <span className="text-green-400">
                  {formatBytes(totalIn)} ← {formatBytes(totalOut)} (وفّرنا {Math.max(0, Math.round((1 - totalOut / totalIn) * 100))}%)
                </span>
              )}
              <Btn size="sm" variant="outline" className="ms-auto" onClick={clearAll}><Trash2 size={13} /> مسح الكل</Btn>
            </div>
            <div className="divide-y divide-gray-700/60">
              {items.map(i => (
                <Row key={i.id} item={i} targetKb={Number(targetKb)}
                  onRemove={() => remove(i.id)}
                  onCompare={() => setCompare(i)}
                  onDownload={() => downloadBlob(i.result.blob, i.name)} />
              ))}
            </div>
          </Card>
        )}
      </div>

      {compare && <CompareModal item={compare} onClose={() => setCompare(null)} />}
    </div>
  );
}

function revoke(i) {
  if (i.origUrl) URL.revokeObjectURL(i.origUrl);
  if (i.outUrl) URL.revokeObjectURL(i.outUrl);
}

function Row({ item: i, targetKb, onRemove, onCompare, onDownload }) {
  const r = i.result;
  const over = r && r.blob.size > targetKb * 1024;
  return (
    <div className="flex items-center gap-3 p-3">
      <img src={i.outUrl || i.origUrl} alt="" className="w-16 h-12 rounded-md object-cover bg-gray-900 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-100 truncate" dir="ltr" title={i.file.name}>{i.file.name}</p>
        <div className="text-xs text-gray-500 flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
          <span>{formatBytes(i.file.size)}{r && ` · ${r.origWidth}×${r.origHeight}`}</span>
          {r && (
            <span className={over ? 'text-amber-400' : 'text-green-400'}>
              ← {formatBytes(r.blob.size)} · {r.width}×{r.height} · جودة {r.quality}%
              {r.resized && ' · تصغير بنفس النسبة'}
            </span>
          )}
          {i.status === 'error' && <span className="text-red-400">{i.error}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {i.status === 'working' && <Loader2 size={16} className="animate-spin text-blue-400" />}
        {i.status === 'waiting' && <span className="text-xs text-gray-500">بالانتظار</span>}
        {i.status === 'done' && (
          <>
            <CheckCircle2 size={16} className="text-green-400 me-1" />
            <button onClick={onCompare} title="مقارنة قبل وبعد" className="p-1.5 text-gray-400 hover:text-blue-400"><Eye size={16} /></button>
            <button onClick={onDownload} title="تحميل" className="p-1.5 text-gray-400 hover:text-blue-400"><Download size={16} /></button>
          </>
        )}
        <button onClick={onRemove} title="إزالة" className="p-1.5 text-gray-500 hover:text-red-400"><Trash2 size={16} /></button>
      </div>
    </div>
  );
}

// مقارنة قبل/بعد بشريط سحب — للتأكد إن الشكل ما تغيّر
function CompareModal({ item, onClose }) {
  const [pos, setPos] = useState(50);
  const r = item.result;
  return (
    <Modal open onClose={onClose} title="قبل وبعد" width="max-w-4xl">
      <div className="space-y-3">
        <div className="relative w-full overflow-hidden rounded-lg bg-gray-900 select-none" dir="ltr"
          style={{ aspectRatio: `${r.origWidth} / ${r.origHeight}`, maxHeight: '70vh' }}>
          <img src={item.outUrl} alt="بعد" className="absolute inset-0 w-full h-full object-contain" />
          <img src={item.origUrl} alt="قبل" className="absolute inset-0 w-full h-full object-contain"
            style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />
          <div className="absolute top-0 bottom-0 w-0.5 bg-white/80 pointer-events-none" style={{ left: `${pos}%` }} />
          <span className="absolute top-2 left-2 text-xs bg-black/60 text-white px-2 py-0.5 rounded">الأصل · {formatBytes(item.file.size)}</span>
          <span className="absolute top-2 right-2 text-xs bg-black/60 text-white px-2 py-0.5 rounded">WebP · {formatBytes(r.blob.size)}</span>
        </div>
        <input type="range" min="0" max="100" value={pos} onChange={e => setPos(Number(e.target.value))} className="w-full" dir="ltr" />
        <p className="text-xs text-gray-500 text-center">حرّك الشريط للمقارنة — {r.origWidth}×{r.origHeight} ← {r.width}×{r.height} · جودة {r.quality}%</p>
      </div>
    </Modal>
  );
}
